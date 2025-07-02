import {
  getCurrentDateTime,
  getCurrentDateTimeFunctionDeclaration,
} from './date-time.js';

export default {
  default: () => 'No function found',
  get_current_date_time: [
    getCurrentDateTime,
    getCurrentDateTimeFunctionDeclaration,
  ],
};
