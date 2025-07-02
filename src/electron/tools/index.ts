import {
  getCurrentDateTime,
  getCurrentDateTimeFunctionDeclaration,
} from './date-time.js';
import { calculate, calculateFunctionDeclaration } from './calculator.js';
import {
  getSystemInfo,
  getSystemInfoFunctionDeclaration,
} from './system-info.js';

export default {
  default: () => 'No function found',
  get_current_date_time: [
    getCurrentDateTime,
    getCurrentDateTimeFunctionDeclaration,
  ],
  calculate: [calculate, calculateFunctionDeclaration],
  get_system_info: [getSystemInfo, getSystemInfoFunctionDeclaration],
};
