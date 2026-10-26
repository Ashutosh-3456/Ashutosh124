const OCR_MODEL =
  process.env.SARVAM_OCR_MODEL ||
  "sarvam-vision-v1";

function cleanJsonText(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function formatStructuredMedicalData(data) {
  const lines = [];

  if (data.documentType) {
    lines.push(
      `Document type: ${data.documentType}`
    );
  }

  if (data.date) {
    lines.push(
      `Date: ${data.date}`
    );
  }

  if (
    Array.isArray(data.medications) &&
    data.medications.length
  ) {
    lines.push("Medications:");

    for (
      const item of data.medications
    ) {
      const details = [
        item?.name,
        item?.strength,
        item?.dose,
        item?.frequency,
        item?.duration,
      ]
        .filter(Boolean)
        .join(" • ");

      if (details) {
        lines.push(
          `• ${details}`
        );
      }
    }
  }

  if (
    Array.isArray(data.investigations) &&
    data.investigations.length
  ) {
    lines.push(
      "Investigations:"
    );

    for (
      const item of data.investigations
    ) {
      const details = [
        item?.test,
        item?.value,
        item?.unit,
        item?.referenceRange
          ? `Ref: ${item.referenceRange}`
          : "",
      ]
        .filter(Boolean)
        .join(" • ");

      if (details) {
        lines.push(
          `• ${details}`
        );
      }
    }
  }

  if (
    Array.isArray(
      data.diagnosesMentioned
    ) &&
    data.diagnosesMentioned.length
  ) {
    lines.push(
      `Diagnoses mentioned: ${data.diagnosesMentioned.join(
        ", "
      )}`
    );
  }

  if (
    Array.isArray(
      data.proceduresMentioned
    ) &&
    data.proceduresMentioned.length
  ) {
    lines.push(
      `Procedures mentioned: ${data.proceduresMentioned.join(
        ", "
      )}`
    );
  }

  if (
    Array.isArray(
      data.allergiesMentioned
    ) &&
    data.allergiesMentioned.length
  ) {
    lines.push(
      `Allergies mentioned: ${data.allergiesMentioned.join(
        ", "
      )}`
    );
  }

  if (
    Array.isArray(data.warnings) &&
    data.warnings.length
  ) {
    lines.push(
      `Warnings: ${data.warnings.join(
        " | "
      )}`
    );
  }

  return lines.join("\n");
}

function buildDataUrl(
  mimeType,
  base64
) {
  return `data:${mimeType};base64,${base64}`;
}

export async function processMedicalDocument(
  file,
  language = "en"
) {
  const apiKey =
    process.env.SARVAM_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SARVAM_API_KEY is missing from server/.env"
    );
  }
  const inputFile = file && typeof file === "object"
  ? file
  : {};

let fileName = String(
  inputFile.fileName ||
  inputFile.originalname ||
  "medical-document"
).trim();

let mimeType = String(
  inputFile.mimeType ||
  inputFile.mimetype ||
  "application/octet-stream"
).trim().toLowerCase();

let documentBuffer = null;

// Support the old Multer format
if (Buffer.isBuffer(inputFile.buffer)) {
  documentBuffer = inputFile.buffer;
}

// Support the new Base64 JSON format
else if (
  typeof inputFile.base64Data === "string" &&
  inputFile.base64Data.trim()
) {
  let base64 = inputFile.base64Data.trim();

  // Remove data URL prefix if present
  if (base64.includes(",")) {
    base64 = base64.split(",").pop() || "";
  }

  // Remove whitespace
  base64 = base64.replace(/\s/g, "");

  // Support URL-safe Base64
  base64 = base64
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  // Restore Base64 padding
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  documentBuffer = Buffer.from(
    base64,
    "base64"
  );
}

if (!documentBuffer || !documentBuffer.length) {
  throw new Error(
    "No valid document was received."
  );
}
const extension =
  fileName
    .split(".")
    .pop()
    ?.toLowerCase() || "";

const inferredMimeTypes = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

const normalizedMimeType =
  mimeType === "application/octet-stream" &&
  inferredMimeTypes[extension]
    ? inferredMimeTypes[extension]
    : mimeType;

  const languageCodes = {
    en: "en-IN",
    hi: "hi-IN",
    bn: "bn-IN",
    mr: "mr-IN",
    te: "te-IN",
    ta: "ta-IN",
  };

  const sarvamLanguage =
    languageCodes[
      String(language).toLowerCase()
    ] || "en-IN";

  const schema = {
    type: "object",

    properties: {
      transcription: {
        type: "string",
        description:
          "Complete readable transcription of the medical document. Do not invent unclear text.",
      },

      documentType: {
        type: "string",
        description:
          "Type of medical document, such as prescription, laboratory report, discharge summary, or consultation note.",
      },

      date: {
        type: "string",
        description:
          "Date explicitly written in the document, or empty if not readable.",
      },

      medications: {
        type: "array",
        description:
          "Medicines explicitly mentioned in the document with readable details.",

        items: {
          type: "object",

          description:
            "One medicine entry with any readable prescription details.",

          properties: {
            name: {
              type: "string",
              description:
                "Name of the medicine.",
            },

            strength: {
              type: "string",
              description:
                "Strength of the medicine, if shown.",
            },

            dose: {
              type: "string",
              description:
                "Prescribed dose, if shown.",
            },

            frequency: {
              type: "string",
              description:
                "How often the medicine is prescribed, if shown.",
            },

            duration: {
              type: "string",
              description:
                "How long the medicine is prescribed, if shown.",
            },
          },
        },
      },

      investigations: {
        type: "array",
        description:
          "Laboratory or diagnostic tests and their readable values.",

        items: {
          type: "object",

          description:
            "One laboratory or diagnostic investigation with any readable result details.",

          properties: {
            test: {
              type: "string",
              description:
                "Name of the laboratory or diagnostic test.",
            },

            value: {
              type: "string",
              description:
                "Reported result value, if shown.",
            },

            unit: {
              type: "string",
              description:
                "Unit of the reported result, if shown.",
            },

            referenceRange: {
              type: "string",
              description:
                "Reference range shown on the document, if available.",
            },
          },
        },
      },

      diagnosesMentioned: {
        type: "array",
        description:
          "Diagnoses explicitly mentioned in the document.",

        items: {
          type: "string",
          description:
            "A diagnosis explicitly mentioned in the document.",
        },
      },

      proceduresMentioned: {
        type: "array",
        description:
          "Procedures explicitly mentioned in the document.",

        items: {
          type: "string",
          description:
            "A procedure explicitly mentioned in the document.",
        },
      },

      allergiesMentioned: {
        type: "array",
        description:
          "Allergies explicitly mentioned in the document.",

        items: {
          type: "string",
          description:
            "An allergy explicitly mentioned in the document.",
        },
      },

      warnings: {
        type: "array",
        description:
          "Uncertainty or readability warnings. Do not diagnose.",

        items: {
          type: "string",
          description:
            "A warning about uncertainty or readability in the extracted document.",
        },
      },
    },
  };

  const form = new FormData();

const sarvamBlob = new Blob(
  [documentBuffer],
  {
    type: normalizedMimeType
  }
);

form.append(
  "file",
  sarvamBlob,
  fileName
);

form.append(
  "schema",
  JSON.stringify(schema)
);

form.append(
  "language",
  sarvamLanguage
);

form.append(
  "output_format",
  "json"
);

form.append(
  "model",
  OCR_MODEL
);

  console.log(
  `[OCR] provider=Sarvam model=${OCR_MODEL} language=${sarvamLanguage} file=${fileName}`
);

  const createResponse =
    await fetch(
      "https://api.sarvam.ai/doc-ai/v1/job/extract",
      {
        method: "POST",

        headers: {
          "api-subscription-key":
            apiKey,
        },

        body: form,
      }
    );

  const createText =
    await createResponse.text();

  let createData = null;

  try {
    createData =
      JSON.parse(
        createText
      );
  } catch {
    // handled below
  }

  if (
    !createResponse.ok
  ) {
    throw new Error(
      createData?.error?.message ||
        createData?.message ||
        `Sarvam Document AI request failed with status ${createResponse.status}.`
    );
  }

  const jobId =
    createData?.job_id;

  if (!jobId) {
    throw new Error(
      "Sarvam Document AI did not return a job ID."
    );
  }

  const terminalStates =
    new Set([
      "completed",
      "partially_completed",
      "failed",
      "rejected",
    ]);

  let statusData =
    createData;

  for (
    let attempt = 0;
    attempt < 60;
    attempt += 1
  ) {
    const currentStatus =
      String(
        statusData?.status ||
          ""
      ).toLowerCase();

    if (
      terminalStates.has(
        currentStatus
      )
    ) {
      break;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          2000
        )
    );

    const statusResponse =
      await fetch(
        `https://api.sarvam.ai/doc-ai/v1/job/${encodeURIComponent(
          jobId
        )}/status`,
        {
          headers: {
            "api-subscription-key":
              apiKey,
          },
        }
      );

    const statusText =
      await statusResponse.text();

    try {
      statusData =
        JSON.parse(
          statusText
        );
    } catch {
      throw new Error(
        "Sarvam Document AI returned an invalid status response."
      );
    }

    if (
      !statusResponse.ok
    ) {
      throw new Error(
        statusData?.error?.message ||
          statusData?.message ||
          `Sarvam Document AI status request failed with status ${statusResponse.status}.`
      );
    }
  }

  const finalStatus =
    String(
      statusData?.status ||
        ""
    ).toLowerCase();

  if (
    !terminalStates.has(
      finalStatus
    )
  ) {
    throw new Error(
      "Sarvam Document AI processing timed out. Please try again."
    );
  }

  if (
    finalStatus === "failed" ||
    finalStatus === "rejected"
  ) {
    throw new Error(
      statusData?.error?.message ||
        statusData?.message ||
        `Sarvam Document AI job ${finalStatus}.`
    );
  }

  const resultsResponse =
    await fetch(
      `https://api.sarvam.ai/doc-ai/v1/job/${encodeURIComponent(
        jobId
      )}/results`,
      {
        headers: {
          "api-subscription-key":
            apiKey,
        },
      }
    );

  const resultsText =
    await resultsResponse.text();

  let resultsData = null;

  try {
    resultsData =
      JSON.parse(
        resultsText
      );
  } catch {
    throw new Error(
      "Sarvam Document AI returned an invalid results response."
    );
  }

  if (
    !resultsResponse.ok
  ) {
    throw new Error(
      resultsData?.error?.message ||
        resultsData?.message ||
        `Sarvam Document AI results request failed with status ${resultsResponse.status}.`
    );
  }

  const structured =
    resultsData?.result ||
    resultsData?.results?.[0]?.result ||
    resultsData?.data?.result ||
    {};

  const safeStructured = {
    transcription:
      structured?.transcription ||
      "",

    documentType:
      structured?.documentType ||
      "",

    date:
      structured?.date ||
      "",

    medications:
      Array.isArray(
        structured?.medications
      )
        ? structured.medications
        : [],

    investigations:
      Array.isArray(
        structured?.investigations
      )
        ? structured.investigations
        : [],

    diagnosesMentioned:
      Array.isArray(
        structured?.diagnosesMentioned
      )
        ? structured.diagnosesMentioned
        : [],

    proceduresMentioned:
      Array.isArray(
        structured?.proceduresMentioned
      )
        ? structured.proceduresMentioned
        : [],

    allergiesMentioned:
      Array.isArray(
        structured?.allergiesMentioned
      )
        ? structured.allergiesMentioned
        : [],

    warnings:
      Array.isArray(
        structured?.warnings
      )
        ? structured.warnings
        : [],
  };

  const text =
    safeStructured.transcription ||
    "";

  return {
    text,

    structured:
      safeStructured,

    structuredText:
      formatStructuredMedicalData(
        safeStructured
      ) || text,
  };
}