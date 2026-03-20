from .config import settings


def main() -> None:
    print(f"{settings.worker_name} booted with log level {settings.worker_log_level}")


if __name__ == "__main__":
    main()
