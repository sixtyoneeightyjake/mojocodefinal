import { z } from 'zod';

export const stdioServerConfigSchema = z
  .object({
    type: z.enum(['stdio']).optional(),
    command: z.string().min(1, 'Command cannot be empty'),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    env: z.record(z.string()).optional(),
  })
  .transform((data) => ({
    ...data,
    type: 'stdio' as const,
  }));
export type STDIOServerConfig = z.infer<typeof stdioServerConfigSchema>;

export const sseServerConfigSchema = z
  .object({
    type: z.enum(['sse']).optional(),
    url: z.string().url('URL must be a valid URL format'),
    headers: z.record(z.string()).optional(),
  })
  .transform((data) => ({
    ...data,
    type: 'sse' as const,
  }));
export type SSEServerConfig = z.infer<typeof sseServerConfigSchema>;

export const streamableHTTPServerConfigSchema = z
  .object({
    type: z.enum(['streamable-http']).optional(),
    url: z.string().url('URL must be a valid URL format'),
    headers: z.record(z.string()).optional(),
  })
  .transform((data) => ({
    ...data,
    type: 'streamable-http' as const,
  }));
export type StreamableHTTPServerConfig = z.infer<typeof streamableHTTPServerConfigSchema>;

export const mcpServerConfigSchema = z.union([
  stdioServerConfigSchema,
  sseServerConfigSchema,
  streamableHTTPServerConfigSchema,
]);
export type MCPServerConfig = z.infer<typeof mcpServerConfigSchema>;

export const mcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), mcpServerConfigSchema),
});
export type MCPConfig = z.infer<typeof mcpConfigSchema>;

export const DEFAULT_MCP_CONFIG: MCPConfig = {
  mcpServers: {
    context7: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp', '--api-key', 'ctx7sk-99c9530c-3e4c-4a0b-8277-55d5509d46a8'],
    },
    'sequential-thinking': {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    },
    'tavily-remote-mcp': {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'mcp-remote', 'https://mcp.tavily.com/mcp/?tavilyApiKey=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'],
      env: {},
    },
    'desktop-commander': {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@wonderwhy-er/desktop-commander@latest'],
    },
  },
};

export function cloneMCPConfig(config: MCPConfig): MCPConfig {
  return JSON.parse(JSON.stringify(config)) as MCPConfig;
}

export type MCPServerAvailable = {
  status: 'available';
  tools: Record<string, unknown>;
  client?: unknown;
  config: MCPServerConfig;
};

export type MCPServerUnavailable = {
  status: 'unavailable';
  error: string;
  client: null | unknown;
  config: MCPServerConfig;
};

export type MCPServer = MCPServerAvailable | MCPServerUnavailable;

export type MCPServerTools = Record<string, MCPServer>;
