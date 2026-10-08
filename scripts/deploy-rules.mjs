import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const project = "herd-roundup-e7f31";
const releaseName = "cloud.firestore";
const rules = readFileSync(
  new URL("../firestore.rules", import.meta.url),
  "utf8",
);

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();

function statusOf(error) {
  if (error && error.response && error.response.status)
    return error.response.status;
  if (error && error.status) return error.status;
  return 0;
}

function detail(error) {
  const body = error && error.response && error.response.data;
  if (typeof body === "string") return body;
  if (body) return JSON.stringify(body);
  return error && error.message ? error.message : String(error);
}

const created = await client.request({
  url: `https://firebaserules.googleapis.com/v1/projects/${project}/rulesets`,
  method: "POST",
  data: {
    source: {
      files: [{ name: "firestore.rules", content: rules }],
    },
  },
});
const rulesetName = created.data && created.data.name;
if (!rulesetName)
  throw new Error("The rules service did not return a ruleset name.");

const release = {
  name: `projects/${project}/releases/${releaseName}`,
  rulesetName,
};

try {
  await client.request({
    url: `https://firebaserules.googleapis.com/v1/projects/${project}/releases/${encodeURIComponent(releaseName)}`,
    method: "PATCH",
    data: { release },
  });
} catch (error) {
  if (statusOf(error) !== 404) {
    throw new Error(`Could not update the rules release: ${detail(error)}`);
  }
  try {
    await client.request({
      url: `https://firebaserules.googleapis.com/v1/projects/${project}/releases`,
      method: "POST",
      data: release,
    });
  } catch (createError) {
    throw new Error(
      `Could not create the rules release: ${detail(createError)}`,
    );
  }
}

console.log(`Released ${rulesetName}`);
