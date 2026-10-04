import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { VisitSession } from "../types/visit.js";

/**
 * Deterministic story synthesizer based on camera hops, dwell times, and outcome.
 * Generates natural, clear household log narratives without requiring external LLM calls.
 */
export function generateDeterministicStory(visit: VisitSession): string {
  const startTimeStr = new Date(visit.startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const durationSec = Math.round(visit.durationMs / 1000);
  const gateDwell = Math.round((visit.dwellTimeByZone.gate || 0) / 1000);
  const walkwayDwell = Math.round((visit.dwellTimeByZone.walkway || 0) / 1000);
  const doorDwell = Math.round((visit.dwellTimeByZone.door || 0) / 1000);

  const zonesVisited = Array.from(new Set(visit.cameraChain.map((h) => h.zone)));

  if (visit.outcome === "driveby_noise" || visit.state === "NOISE") {
    return `At ${startTimeStr}, transient motion was detected at the Front Gate. No further progression occurred; flagged as brief street activity or passing noise.`;
  }

  if (visit.outcome === "loitering") {
    return `At ${startTimeStr}, repeated motion was detected at the Front Gate (${gateDwell}s dwell). The individual did not advance down the walkway and remained lingering by the entrance.`;
  }

  if (visit.outcome === "turned_back" || visit.state === "ABANDONED") {
    return `At ${startTimeStr}, visitor entered through the Front Gate and walked partway along the walkway (${walkwayDwell}s). They turned back toward the gate without approaching the front door.`;
  }

  if (visit.outcome === "direct_door_visit") {
    const chimeNote = visit.doorbellPressed ? " and rang the doorbell" : "";
    return `At ${startTimeStr}, activity began directly at the Front Door (${doorDwell}s dwell)${chimeNote}. The visitor arrived without triggering perimeter gate cameras.`;
  }

  if (visit.outcome === "reached_door_completed" || visit.state === "CLOSED") {
    const chimeNote = visit.doorbellPressed ? ", rang the doorbell," : "";
    const departureStr = zonesVisited.includes("walkway")
      ? "departed back down the walkway"
      : "departed the property";
    return `At ${startTimeStr}, visitor arrived at the Front Gate, proceeded along the walkway (${walkwayDwell}s), reached the front door (${doorDwell}s dwell)${chimeNote} and ${departureStr}. Total visit duration: ${durationSec}s.`;
  }

  if (visit.state === "REACHED_DOOR" || visit.outcome === "reached_door_dwelling") {
    const chimeNote = visit.doorbellPressed ? " and rang the doorbell" : "";
    return `At ${startTimeStr}, visitor navigated from Front Gate through Walkway and is currently at the Front Door (${doorDwell}s dwell)${chimeNote}. Visit is ongoing.`;
  }

  // Default active / in-progress
  const chainStr = visit.cameraChain.map((c) => c.zone).join(" → ");
  return `At ${startTimeStr}, visitor progression detected along [${chainStr}]. Current duration: ${durationSec}s. Visit is active.`;
}

/**
 * Optional Bedrock Nova Lite/Micro Enrichment
 * Invoked only when NOVA_ENRICHMENT_FLAG is true and AWS credentials are valid.
 * Gracefully falls back to deterministic template on error or timeout.
 */
export async function enrichStoryWithNova(
  visit: VisitSession,
  awsRegion = "us-east-1",
): Promise<string> {
  const baseStory = generateDeterministicStory(visit);

  try {
    const client = new BedrockRuntimeClient({ region: awsRegion });
    const prompt = `You are GateStory, an intelligent Ring home security storyteller.
Summarize the following smart home multi-camera visit in 2 concise, reassuring, vivid sentences for a homeowner log.
Include the chronological progression, dwell times, and final outcome.

Raw Data:
- Start Time: ${new Date(visit.startTime).toISOString()}
- Total Duration: ${Math.round(visit.durationMs / 1000)} seconds
- Outcome: ${visit.outcome}
- Doorbell Pressed: ${visit.doorbellPressed}
- Dwell Times: Gate=${Math.round(visit.dwellTimeByZone.gate / 1000)}s, Walkway=${Math.round(visit.dwellTimeByZone.walkway / 1000)}s, Door=${Math.round(visit.dwellTimeByZone.door / 1000)}s
- Trajectory: ${visit.cameraChain.map((h) => `${h.zone} (${h.eventType})`).join(" -> ")}
- Baseline Summary: ${baseStory}

Output ONLY the final 2-sentence narrative. Do not include markdown headers or bullet points.`;

    // Bedrock Nova Lite format: amazon.nova-lite-v1:0
    const payload = {
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        max_new_tokens: 150,
        temperature: 0.3,
        top_p: 0.9,
      },
    };

    const command = new InvokeModelCommand({
      modelId: "amazon.nova-lite-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: Buffer.from(JSON.stringify(payload)),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const generatedText = responseBody?.output?.message?.content?.[0]?.text;

    if (generatedText && generatedText.trim().length > 0) {
      return generatedText.trim();
    }
    return baseStory;
  } catch (err) {
    // Graceful fallback to deterministic template
    console.warn(`[nova] Bedrock enrichment fallback: ${(err as Error).message}`);
    return baseStory;
  }
}
