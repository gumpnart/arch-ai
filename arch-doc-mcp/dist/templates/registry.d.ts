export interface Template {
    id: string;
    abbr: string;
    name: string;
    category: string;
    mandatory: boolean;
    when: string;
    audience: string;
    purpose: string;
    vaultPath: string;
    frontmatterType: string;
    content: string;
}
export declare const TEMPLATES: Record<string, Template>;
export declare const CATEGORIES: Record<string, {
    label: string;
    color: string;
    docIds: string[];
}>;
export declare const ALL_TEMPLATE_IDS: string[];
