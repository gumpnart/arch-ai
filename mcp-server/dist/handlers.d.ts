import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type Tool } from "@modelcontextprotocol/sdk/types.js";
export declare function ok(msg: string): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function err(msg: string): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
};
export declare const TOOLS: Tool[];
export declare function handleTool(name: string, args: Record<string, unknown>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function createMcpServer(): Server;
//# sourceMappingURL=handlers.d.ts.map