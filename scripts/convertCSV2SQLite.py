import os
import sqlite3
import pandas as pd

def csv_to_sqlite(csv_folder_path, sqlite_db_path, remove_csv=False):
    """
    Convert all CSV files in a specified folder into a single SQLite database.

    This function iterates over each CSV file in the given folder, reads the contents into a pandas DataFrame,
    and writes each DataFrame to a new table in the specified SQLite database. If a CSV file contains columns 
    with case-insensitive duplicate names, they are renamed to ensure unique column names in the SQLite database.

    Parameters:
    - csv_folder_path (str): The path to the folder containing the CSV files.
    - sqlite_db_path (str): The path to the SQLite database file to which the tables will be written. If the file 
      does not exist, it will be created.
    - remove_csv (bool, optional): Whether to remove the CSV files after conversion. Defaults to False.

    Returns:
    - None

    Raises:
    - Exception: If there is an error reading a CSV file or writing to the SQLite database, an exception will be 
      raised and an error message will be printed.

    Example:
    >>> csv_to_sqlite('path/to/csv_folder', 'path/to/database.db', remove_csv=True)
    """
    # Connect to or create the SQLite database
    conn = sqlite3.connect(sqlite_db_path)
    cursor = conn.cursor()

    # Iterate over each CSV file in the folder
    for csv_file in os.listdir(csv_folder_path):
        if csv_file.endswith('.csv'):
            csv_path = os.path.join(csv_folder_path, csv_file)
            table_name = os.path.splitext(csv_file)[0]

            try:
                # Read CSV file into a pandas DataFrame
                df = pd.read_csv(csv_path, low_memory=False)

                # Handle case-insensitive duplicate column names
                lower_columns = [col.lower() for col in df.columns]
                if len(lower_columns) != len(set(lower_columns)):
                    # Rename duplicates while preserving the original case
                    column_map = {}
                    seen = {}
                    for col in df.columns:
                        col_lower = col.lower()
                        if col_lower in seen:
                            seen[col_lower] += 1
                            column_map[col] = f"{col}_duplicate{seen[col_lower]}"
                        else:
                            seen[col_lower] = 0
                            column_map[col] = col
                    df.rename(columns=column_map, inplace=True)

                # Write the DataFrame to the SQLite database
                df.to_sql(table_name, conn, if_exists='fail', index=False)
                print(f"Added table '{table_name}' from CSV file '{csv_path}' to SQLite database '{sqlite_db_path}'.")

                # Optionally remove the CSV file after conversion
                if remove_csv:
                    os.remove(csv_path)

            except Exception as e:
                print(f"Error adding table '{table_name}' to SQLite database '{sqlite_db_path}': {e}")

    conn.commit()
    conn.close()

# User prompts
csv_folder_path = input("Enter the path to the folder containing CSV files: ").strip('"')
sqlite_db_path = input("Enter the path to the SQLite database file (e.g., 'output.db'): ").strip('"')
remove_csv = input("Remove CSV files after conversion? (yes/no): ").lower() == 'yes'

# Main function to convert CSVs to SQLite
csv_to_sqlite(csv_folder_path, sqlite_db_path, remove_csv)
