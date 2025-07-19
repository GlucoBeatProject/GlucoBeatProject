export function parseNestedJsonString(
  dataString: string
): { name: string; output: { columns: any[]; rows: any[] } } | null {
  try {
    let jsonFriendlyString = dataString.replace(/'/g, '"');

    const outputContentRegex = /"output":\s*"(.*)"/;
    const match = jsonFriendlyString.match(outputContentRegex);

    let finalStringToParse: string;

    if (match && match[1]) {
      const outputContent = match[1].replace(/\\"/g, '"');
      finalStringToParse = jsonFriendlyString.replace(
        outputContentRegex,
        `"output": ${outputContent}`
      );
    } else {
      finalStringToParse = jsonFriendlyString;
    }

    const parsedObject = JSON.parse(finalStringToParse);

    if (
      parsedObject &&
      typeof parsedObject.name === 'string' &&
      typeof parsedObject.output === 'object'
    ) {
      return parsedObject as {
        name: string;
        output: { columns: any[]; rows: any[] };
      };
    }

    return null;
  } catch (error) {
    console.error(
      'Failed to parse the Python dict-like string:',
      dataString,
      error
    );
    return null;
  }
}
