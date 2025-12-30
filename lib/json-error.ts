export type JsonError = {
    message: string;
    line?: number;
};

/**
 * Parses a JSON parsing error to extract line and message.
 * Supports V8 style "at position X" messages.
 */
export function getJsonParseError(json: string, error: SyntaxError): JsonError {
    const message = error.message;
    let line = 1;

    // V8 (Chrome/Node) error often format: "Unexpected token X in JSON at position Y"
    const positionMatch = message.match(/at position (\d+)/);

    if (positionMatch) {
        const position = parseInt(positionMatch[1], 10);
        // Calculate line number by counting newlines up to position
        const substring = json.substring(0, position);
        line = substring.split('\n').length;
    } else {
        // Fallback: regex search for line number if format is different (e.g. Firefox sometimes)
        const lineMatch = message.match(/line (\d+)/);
        if (lineMatch) {
            line = parseInt(lineMatch[1], 10);
        }
    }

    // Clean up message to be friendlier
    // Remove "in JSON at position..." part for display
    const cleanMessage = message.replace(/ in JSON at position \d+/, "");

    return {
        message: cleanMessage,
        line
    };
}
