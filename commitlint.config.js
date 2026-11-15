const forbiddenTrailers = (parsed) => {
  const raw = parsed.raw ?? "";
  const bad = /^(Co-Authored-By:\s*Claude|Claude-Session:)/im.test(raw);
  return [!bad, "commit message must not contain Co-Authored-By: Claude or Claude-Session: trailers"];
};

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [{ rules: { "no-claude-trailers": forbiddenTrailers } }],
  rules: { "no-claude-trailers": [2, "always"] },
};
