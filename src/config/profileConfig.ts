import { z } from "zod";
import type { ApprovalStatus, DataClient, ProfileScope } from "../data/dataClient";
import { DISPLAY_STATUS_ORDER } from "../data/displayStatus";

export const CONFIG_SCHEMA_NAME = "bpt_ApprovalsHubConfig";

export const COLUMNS = ["title", "status", "createdOn", "owner", "currentStep", "lastDecision"] as const;
export type ColumnId = (typeof COLUMNS)[number];


const scopeSchema = z.strictObject({
  title: z.strictObject({ mode: z.enum(["equals", "startsWith", "contains"]), value: z.string().min(1) }).optional(),
  category: z.string().min(1).optional(),
  tags: z.string().min(1).optional(),
});

const profileSchema = z.strictObject({
  extends: z.string().min(1).optional(),
  pageTitle: z.string().min(1).optional(),
  scope: scopeSchema.optional(),
  pageSize: z.number().int().min(1).max(500).optional(),
  defaultStatus: z.enum(DISPLAY_STATUS_ORDER as [ApprovalStatus, ...ApprovalStatus[]]).nullable().optional(),
  columns: z.array(z.enum(COLUMNS)).min(1).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must look like #0f6cbd").nullable().optional(),
});

const configSchema = z.strictObject({ profiles: z.record(z.string(), profileSchema) });

type ProfileDefinition = z.infer<typeof profileSchema>;

/** A Profile with `extends` resolved and every setting filled in. */
export interface ResolvedProfile {
  name: string;
  /** Null: use the translated built-in page title. */
  pageTitle: string | null;
  columns: ColumnId[];
  pageSize: number;
  /** Status filter applied when the URL carries none; null for no default. */
  defaultStatus: ApprovalStatus | null;
  accentColor: string | null;
  scope: ProfileScope;
}

export type ConfigNotice = { kind: "invalidConfig"; detail: string } | { kind: "unknownProfile"; name: string };

const DEFAULT_NAME = "default";

const builtInProfile = (): ResolvedProfile => ({
  name: DEFAULT_NAME,
  pageTitle: null,
  columns: [...COLUMNS],
  pageSize: 100,
  defaultStatus: "pending",
  accentColor: null,
  scope: {},
});

class ConfigError extends Error {}

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`).join("; ");
}

function parseConfig(raw: string): Record<string, ProfileDefinition> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ConfigError("The value is not valid JSON.");
  }
  const parsed = configSchema.safeParse(json);
  if (!parsed.success) throw new ConfigError(formatIssues(parsed.error));
  return parsed.data.profiles;
}

/** Definitions from the root of the `extends` chain down to `name`; throws on a cycle or a missing parent. */
function inheritanceChain(profiles: Record<string, ProfileDefinition>, name: string): ProfileDefinition[] {
  const chain: ProfileDefinition[] = [];
  const seen: string[] = [];
  for (let current: string | undefined = name; current !== undefined; ) {
    if (seen.includes(current)) throw new ConfigError(`Profiles extend each other in a cycle: ${[...seen, current].join(" -> ")}.`);
    const definition: ProfileDefinition | undefined = profiles[current];
    if (!definition) throw new ConfigError(`Profile "${seen[seen.length - 1]}" extends "${current}", which does not exist.`);
    seen.push(current);
    chain.unshift(definition);
    current = definition.extends;
  }
  return chain;
}

function resolveDefinition(profiles: Record<string, ProfileDefinition>, name: string): ResolvedProfile {
  const resolved: ResolvedProfile = { ...builtInProfile(), name };
  for (const definition of inheritanceChain(profiles, name)) {
    if (definition.pageTitle !== undefined) resolved.pageTitle = definition.pageTitle;
    if (definition.pageSize !== undefined) resolved.pageSize = definition.pageSize;
    if (definition.defaultStatus !== undefined) resolved.defaultStatus = definition.defaultStatus;
    if (definition.columns !== undefined) resolved.columns = definition.columns;
    if (definition.accentColor !== undefined) resolved.accentColor = definition.accentColor;
    if (definition.scope) resolved.scope = { ...resolved.scope, ...definition.scope };
  }
  return resolved;
}

/**
 * Turns the raw configuration value and the requested profile name into the Profile to show. Never throws:
 * an invalid configuration yields the built-in defaults, an unknown profile yields `default`; each with a notice for the UI.
 */
export function resolveProfile(raw: string | null, requestedName: string | null): { profile: ResolvedProfile; notices: ConfigNotice[] } {
  if (raw === null) return { profile: builtInProfile(), notices: [] };
  try {
    const profiles = parseConfig(raw);
    const notices: ConfigNotice[] = [];
    let name = requestedName ?? DEFAULT_NAME;
    if (name !== DEFAULT_NAME && !(name in profiles)) {
      notices.push({ kind: "unknownProfile", name });
      name = DEFAULT_NAME;
    }
    // A configuration without a `default` profile still has the built-in one.
    const profile = name === DEFAULT_NAME && !(name in profiles) ? builtInProfile() : resolveDefinition(profiles, name);
    return { profile, notices };
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    return { profile: builtInProfile(), notices: [{ kind: "invalidConfig", detail: error.message }] };
  }
}

/** The Profile name from the web resource `data` parameter (`?data=profile%3Dname`) or, for local use, `?profile=name`. */
export function profileNameFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const direct = params.get("profile");
  if (direct) return direct;
  return new URLSearchParams(params.get("data") ?? "").get("profile") || null;
}

/** Reads the environment variable through the DataClient and resolves the Profile; a read failure counts as an invalid configuration. */
export async function loadProfile(client: DataClient, search: string): Promise<{ profile: ResolvedProfile; notices: ConfigNotice[] }> {
  let raw: string | null;
  try {
    raw = await client.loadConfigValue(CONFIG_SCHEMA_NAME);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The configuration could not be read.";
    return { profile: builtInProfile(), notices: [{ kind: "invalidConfig", detail }] };
  }
  return resolveProfile(raw, profileNameFromSearch(search));
}
