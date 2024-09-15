import sqlite3
import os

def extract_create_statements(db_path):
    """
    Connect to an SQLite database and retrieve the 'CREATE TABLE' SQL commands for all tables.
    
    Args:
        db_path (str): Path to the SQLite database file.
        
    Returns:
        dict: A dictionary where keys are table names and values are the 'CREATE TABLE' SQL commands.
    """
    create_statements = []
    
    try:
        # Connect to the SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Query the sqlite_master table to get the CREATE TABLE statements
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        # Extract the SQL commands
        for table in tables:
            if table[0]:  # Some entries might be NULL
                create_statements.append(table[0])
        
        # Close the connection
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error reading {db_path}: {e}")
    
    return create_statements

# Main function to read all DBs in a folder and export the CREATE statements
def export_create_statements_from_folder():
    """
    Main function to retrieve 'CREATE TABLE' commands from all SQLite databases in a folder.
    Allows the user to input the folder path at runtime.
    Outputs a file containing the commands.
    """

    # Get folder path from user input
    folder_path = input("Enter the path to the folder containing the SQLite DBs: ")
    
    if not os.path.exists(folder_path):
        print("The specified folder does not exist.")
        return
    
    # List all files in the folder
    files = os.listdir(folder_path)
    
    # Filter out only the .db or .sqlite files (common SQLite file extensions)
    db_files = [f for f in files if f.endswith('.db') or f.endswith('.sqlite')]
    
    if not db_files:
        print("No SQLite database files found in the specified folder.")
        return
    
    create_commands = []
    
    # Extract CREATE TABLE statements from each database
    for db_file in db_files:
        db_path = os.path.join(folder_path, db_file)
        print(f"Processing {db_file}...")
        create_statements = extract_create_statements(db_path)
        if create_statements:
            create_commands.append(f"-- Database: {db_file}\n" + "\n\n".join(create_statements))
    
    if not create_commands:
        print("No CREATE TABLE statements found in the database files.")
        return
    
    # Save the CREATE TABLE commands to a text file in the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, "create_table_commands.txt")
    
    with open(output_file, 'w') as f:
        f.write("\n\n".join(create_commands))
    
    # Notification where the file has been saved
    print(f"\nCREATE TABLE commands have been exported to: {output_file}")

export_create_statements_from_folder()
