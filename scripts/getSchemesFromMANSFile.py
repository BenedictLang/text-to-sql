import sqlite3
import os

def extract_create_statements_from_mans(file_path):
    create_statements = []
    
    try:
        # Connect to the SQLite database
        conn = sqlite3.connect(file_path)
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
        print(f"Error reading {file_path}: {e}")
    
    return create_statements

def export_create_statements_from_mans():
    # Get file path from user input
    file_path = input("Enter the path to the .mans file: ")
    
    if not os.path.exists(file_path):
        print("The specified file does not exist.")
        return
    
    # Extract CREATE TABLE statements from the .mans file
    print(f"Processing {file_path}...")
    create_statements = extract_create_statements_from_mans(file_path)
    
    if not create_statements:
        print("No CREATE TABLE statements found in the .mans file.")
        return
    
    # Save the CREATE TABLE commands to a text file in the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, "create_table_commands_from_mans.txt")
    
    with open(output_file, 'w') as f:
        f.write("\n\n".join(create_statements))
    
    # Notify the user where the file has been saved
    print(f"\nCREATE TABLE commands have been exported to: {output_file}")

# Run the script
export_create_statements_from_mans()
