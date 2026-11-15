/** The subset of the model-driven app's Xrm client API that the hub uses. */

export type Entity = Record<string, unknown>;

export interface RetrieveMultipleResult {
  entities: Entity[];
  /** Full URL of the next server page; absent on the last page. */
  nextLink?: string;
}

export interface WebApiLike {
  retrieveMultipleRecords(entityLogicalName: string, options?: string, maxPageSize?: number): Promise<RetrieveMultipleResult>;
}

export interface GlobalContextLike {
  getClientUrl(): string;
  userSettings: { userId: string; userName: string; languageId: number };
}

export interface XrmLike {
  WebApi: WebApiLike;
  Navigation?: { openForm(options: { entityName: string; entityId: string }): Promise<unknown> };
  Utility?: { getGlobalContext(): GlobalContextLike };
}

/** Error shape Xrm.WebApi rejects with; `status` is set when the HTTP status is known. */
export interface XrmErrorLike {
  errorCode?: number;
  message?: string;
  status?: number;
}
