import { Type, FunctionDeclaration } from '@google/genai';

export const getCurrentDateTime = () => {
  return new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'long',
  });
};

export const getCurrentDateTimeFunctionDeclaration: FunctionDeclaration = {
  name: 'get_current_date_time',
  description: 'Get the current date and time in current timezone',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};
