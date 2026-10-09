const project = "herd-roundup-e7f31";
const write = process.argv.includes("--write");

process.env.METADATA_SERVER_DETECTION =
  process.env.METADATA_SERVER_DETECTION || "none";
process.env.GOOGLE_CLOUD_QUOTA_PROJECT = project;

const { GoogleAuth } = await import("google-auth-library");
let client;
try {
  client = await new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  }).getClient();
} catch (error) {
  console.error(
    "Google rejected the saved login. Sign in as the account that owns the Firebase project, then run this command again:",
  );
  console.error("  gcloud auth application-default login");
  process.exit(1);
}

async function api(options) {
  try {
    return await client.request(options);
  } catch (error) {
    const data = error && error.response && error.response.data;
    const grant = data && data.error;
    if (grant === "invalid_grant") {
      console.error(
        "Google rejected the saved login. Sign in as the account that owns the Firebase project, then run this command again:",
      );
      console.error("  gcloud auth application-default login");
      process.exit(1);
    }
    const message =
      (data && (data.error_description || data.error?.message || data.error)) ||
      (error && error.message) ||
      "The request failed.";
    console.error(
      typeof message === "string" ? message : JSON.stringify(message),
    );
    process.exit(1);
  }
}

const uids = [];
let pageToken = "";
do {
  const response = await api({
    url: `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/people`,
    method: "GET",
    params: {
      pageSize: 300,
      pageToken,
      "mask.fieldPaths": "member_code",
    },
  });
  const documents = (response.data && response.data.documents) || [];
  for (const document of documents) {
    const uid = String(document.name || "")
      .split("/")
      .pop();
    if (uid) uids.push(uid);
  }
  pageToken = (response.data && response.data.nextPageToken) || "";
} while (pageToken);

let confirmed = 0;
let already = 0;
let missing = 0;
for (const uid of uids) {
  const lookup = await api({
    url: `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
    method: "POST",
    data: { localId: [uid] },
  });
  const user = lookup.data && lookup.data.users && lookup.data.users[0];
  if (!user || user.localId !== uid) {
    missing += 1;
    continue;
  }
  if (user.emailVerified) {
    already += 1;
    continue;
  }
  if (!write) {
    confirmed += 1;
    continue;
  }
  await api({
    url: `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`,
    method: "POST",
    data: { localId: uid, emailVerified: true },
  });
  confirmed += 1;
}

console.log(`${uids.length} profiles`);
console.log(
  write
    ? `Marked ${confirmed} confirmed. ${already} were already confirmed. ${missing} had no sign-in.`
    : `Would mark ${confirmed} confirmed. ${already} are already confirmed. ${missing} have no sign-in. Run with --write to update.`,
);
