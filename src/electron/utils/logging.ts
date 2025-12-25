import chalk from "chalk";

export const JSON_PRINT = (j: any) => {
  return "\n" + JSON.stringify(j, null, 2) + "\n";
};

export const LOG = (TAG: string) => {
  return {
    INFO: (...args: any[]) => {
      console.log(
        chalk.magenta(new Date().toISOString() + "\t"),
        chalk.bgBlue("INFO"),
        "    ",
        chalk.bgGray(TAG),
        ...args.map((arg) => chalk.blue(arg)),
      );
    },
    SUCCESS: (...args: any[]) => {
      console.log(
        chalk.magenta(new Date().toISOString() + "\t"),
        chalk.bgGreen("SUCCESS"),
        "    ",
        chalk.bgGray(TAG),
        ...args.map((arg) => chalk.green(arg)),
      );
    },
    WARN: (...args: any[]) => {
      console.log(
        chalk.magenta(new Date().toISOString() + "\t"),
        chalk.bgYellow("WARN"),
        "    ",
        chalk.bgGray(TAG),
        ...args.map((arg) => chalk.yellow(arg)),
      );
    },
    ERROR: (...args: any[]) => {
      console.log(
        chalk.magenta(new Date().toISOString() + "\t"),
        chalk.bgRed("ERROR"),
        "    ",
        chalk.bgGray(TAG),
        ...args.map((arg) => chalk.red(arg)),
      );
    },
  };
};
