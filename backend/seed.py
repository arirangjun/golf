"""CLI: create tables and seed default accounts."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import init_database


def main() -> None:
    result = init_database()
    print("Seed completed:", result)
    print("  Admin: admin@golf.com / admin1234")
    print("  Member: 101동 1001호 / password: 1")


if __name__ == "__main__":
    main()
