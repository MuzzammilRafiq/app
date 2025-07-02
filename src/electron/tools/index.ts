import {
  getCurrentDateTime,
  getCurrentDateTimeFunctionDeclaration,
} from './time/index.js';

export default {
  default: () => 'No function found',
  get_current_date_time: [
    getCurrentDateTime,
    getCurrentDateTimeFunctionDeclaration,
  ],
};
