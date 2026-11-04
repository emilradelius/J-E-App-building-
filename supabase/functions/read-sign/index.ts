// read-sign: reads a photo of a Swedish parking sign with Claude and stores
// the rules it finds on the report (parking_reports.sign_reading).
//
// Called by the Car Parking Finder right after a "Road sign" report with a
// photo is saved. Each report is read at most once.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.1.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SignReading = z.object({
  is_parking_sign: z.boolean().describe("Does the photo show a parking/stopping sign (incl. supplementary plates)?"),
  summary_en: z.string().describe("One or two plain English sentences: can I park here, when, how long, and does it cost?"),
  summary_sv: z.string().describe("The same summary in Swedish."),
  rules: z.array(
    z.object({
      when: z.string().describe("Days and times this rule applies, e.g. 'Mon-Fri 08-18', 'Sat 10-15', 'always'. Swedish signs: plain numbers = weekdays, (parentheses) = Saturdays/day before holiday, red numbers = Sundays/holidays."),
      parking_allowed: z.boolean(),
      max_stay_minutes: z.number().int().nullable(),
      fee: z.enum(["free", "paid", "unknown"]),
      requires: z.string().nullable().describe("e.g. 'parking disc', 'residents permit zone C', 'ticket/app' or null"),
    }),
  ),
  street_cleaning: z.string().nullable().describe("Datumparkering / street cleaning times if shown, else null"),
  confidence: z.enum(["high", "medium", "low"]),
});

const PROMPT = `This is a photo a driver took of a road sign in Sweden, to share parking rules with other drivers.
Read every parking or stopping sign and supplementary plate in the photo (P-sign, "Avgift", "2 tim", "Boende", time ranges, parking disc symbol, "Datumparkering", no-stopping/no-parking signs, etc.).
Report the rules exactly as signed. If something is unreadable or ambiguous, say so in the summary and lower the confidence. Do not guess times or prices that are not on the sign.
If the photo is not a parking-related sign, set is_parking_sign to false and leave rules empty.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let reportId: string;
  try {
    ({ report_id: reportId } = await req.json());
    if (typeof reportId !== "string" || !/^[0-9a-f-]{36}$/.test(reportId)) throw new Error();
  } catch {
    return json({ error: "Send {\"report_id\": \"<uuid>\"}" }, 400);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: report, error } = await db
    .from("parking_reports")
    .select("id, type, photo_path, sign_reading")
    .eq("id", reportId)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!report) return json({ error: "Report not found" }, 404);
  if (report.sign_reading) return json({ reading: report.sign_reading }); // already read once
  if (report.type !== "sign" || !report.photo_path) return json({ error: "Only road-sign reports with a photo can be read" }, 400);

  const photoUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/report-photos/${report.photo_path}`;

  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "Sign reader is not set up yet (missing API key)" }, 503);
  const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
  let reading;
  try {
    const msg = await anthropic.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // If a safety classifier declines, retry on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(SignReading) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: photoUrl } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    if (msg.stop_reason === "refusal") return json({ error: "The sign could not be read" }, 422);
    if (!msg.parsed_output) return json({ error: "Could not understand the sign" }, 422);
    reading = msg.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Busy, try again in a minute" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "Sign reader is not set up yet (missing API key)" }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: `Sign reader failed (${e.status})` }, 502);
    throw e;
  }

  const { error: upErr } = await db.from("parking_reports").update({ sign_reading: reading }).eq("id", reportId);
  if (upErr) return json({ error: upErr.message }, 500);
  return json({ reading });
});
