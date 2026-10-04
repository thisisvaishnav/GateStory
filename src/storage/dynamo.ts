import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { AccessLogEntry, GateRule, VisitSession } from "../types/visit.js";
import type { StorageRepository } from "./repository.js";

export interface DynamoConfig {
  tableName: string;
  region: string;
  endpoint?: string;
}

export class DynamoRepository implements StorageRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(config: DynamoConfig) {
    this.tableName = config.tableName;
    const client = new DynamoDBClient({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    });
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  public async saveVisit(visit: VisitSession): Promise<void> {
    const item = {
      PK: `VISIT#${visit.id}`,
      SK: "METADATA",
      GSI1PK: "VISITS",
      GSI1SK: `START#${visit.startTime}`,
      entityType: "VISIT",
      ...visit,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  public async getVisitById(id: string): Promise<VisitSession | null> {
    const response = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `VISIT#${id}`,
          SK: "METADATA",
        },
      }),
    );

    if (!response.Item) return null;
    return response.Item as unknown as VisitSession;
  }

  public async listVisits(options?: { outcome?: string; limit?: number }): Promise<VisitSession[]> {
    const limit = options?.limit || 50;

    const response = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "VISITS",
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );

    let items = (response.Items || []) as unknown as VisitSession[];
    if (options?.outcome) {
      items = items.filter((v) => v.outcome === options.outcome);
    }
    return items;
  }

  public async createRule(rule: GateRule): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `RULE#${rule.id}`,
          SK: "CONFIG",
          entityType: "RULE",
          ...rule,
        },
      }),
    );
  }

  public async listRules(): Promise<GateRule[]> {
    const response = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "entityType = :type",
        ExpressionAttributeValues: {
          ":type": "RULE",
        },
      }),
    );
    return (response.Items || []) as unknown as GateRule[];
  }

  public async logAccess(entry: AccessLogEntry): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `LOG#${entry.id}`,
          SK: `TIMESTAMP#${entry.timestamp}`,
          entityType: "ACCESS_LOG",
          ...entry,
        },
      }),
    );
  }

  public async listAccessLogs(options?: {
    limit?: number;
    source?: string;
  }): Promise<AccessLogEntry[]> {
    const limit = options?.limit || 100;
    const response = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "entityType = :type",
        ExpressionAttributeValues: {
          ":type": "ACCESS_LOG",
        },
        Limit: limit,
      }),
    );
    let items = (response.Items || []) as unknown as AccessLogEntry[];
    items.sort((a, b) => b.timestamp - a.timestamp);
    if (options?.source) {
      items = items.filter((l) => l.source === options.source);
    }
    return items;
  }
}
