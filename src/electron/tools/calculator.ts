import { Type, FunctionDeclaration } from '@google/genai';

export const calculate = (expression: string) => {
  try {
    // Basic safety check to prevent code injection
    const safeExpression = expression.replace(/[^0-9+\-*/(). ]/g, '');

    if (safeExpression !== expression) {
      return 'Error: Invalid characters in expression. Only numbers and basic operators (+, -, *, /, (, )) are allowed.';
    }

    // Use Function constructor for safe evaluation
    const result = Function(`"use strict"; return (${safeExpression})`)();

    if (typeof result !== 'number' || !isFinite(result)) {
      return 'Error: Invalid mathematical expression';
    }

    return `${expression} = ${result}`;
  } catch (error) {
    return `Error calculating expression: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

export const calculateFunctionDeclaration: FunctionDeclaration = {
  name: 'calculate',
  description: 'Perform basic mathematical calculations',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expression: {
        type: Type.STRING,
        description: "Mathematical expression to calculate (e.g., '2 + 3 * 4')",
      },
    },
    required: ['expression'],
  },
};
