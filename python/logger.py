from colorama import init, Fore, Back, Style

init(autoreset=True)

def log_error(message):
    print(f"{Fore.RED}{Style.BRIGHT}ERROR: {message}{Style.RESET_ALL}")

def log_success(message):
    print(f"{Fore.GREEN}{Style.BRIGHT}SUCCESS: {message}{Style.RESET_ALL}")

def log_info(message):
    print(f"{Fore.BLUE}{Style.BRIGHT}INFO: {message}{Style.RESET_ALL}")

def log_warning(message):
    print(f"{Fore.YELLOW}{Style.BRIGHT}WARNING: {message}{Style.RESET_ALL}")