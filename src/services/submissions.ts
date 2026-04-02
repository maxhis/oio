const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export interface SiteSubmissionInput {
  website: string;
  description: string;
  contact: string;
  company: string;
}

export function createEmptySiteSubmissionInput(): SiteSubmissionInput {
  return {
    website: "",
    description: "",
    contact: "",
    company: "",
  };
}

export async function submitSiteSubmission(input: SiteSubmissionInput): Promise<{ ok: true }> {
  const response = await fetch(`${API_BASE_URL}/api/submissions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json() as { error?: string };
      message = payload.error || message;
    } catch {
      const text = await response.text();
      message = text || message;
    }

    throw new Error(message);
  }

  return response.json() as Promise<{ ok: true }>;
}
