import compresser as compresser
import json

def dico_columns_tuple(data: list[list[str]], header: list[str], column_names: list[str]) -> dict[str, list[str]]:
    """
    Create a dictionary mapping tuples of values from specified columns to their counts.

    Args:
        data (list[list[str]]): The input data as a list of rows, where each row is a list of strings.
        header (list[str]): The header row containing column names.
        column_names (list[str]): The names of the columns to create tuples from.
    Returns:
        dict[str, list[str]]: A dictionary where keys are from the first column et values are from the second column.
    """
    column_indices = [header.index(name) for name in column_names]
    tuple_counts: dict[str, list[str]] = {}
    
    for row in data:
        if len(row) > max(column_indices):
            key = row[column_indices[0]]
            value = row[column_indices[1]]
            if key in tuple_counts:
                if value not in tuple_counts[key]:
                    tuple_counts[key].append(value)
            else:
                tuple_counts[key] = [value]
    return tuple_counts


def merger(input_file_path_name: str, input_file_path_code: str, output_file_path: str) -> None:
    """
    Merges two files based on a common key and outputs the merged data.

    Args:
        input_file_path_name (str): Path to the first json input file containing names.
        input_file_path_code (str): Path to the second json input file containing codes.
        output_file_path (str): Path to the output file for the merged data.
    """
    try:
        name_dico = compresser.open_json_file(input_file_path_name)
        code_dico = compresser.open_json_file(input_file_path_code)
    except Exception as e:
        name_dico = {}
        code_dico = {}
        print(f"Error opening files: {e}")

    if not name_dico or not code_dico:
        print("One or both of the input dictionaries are empty. Cannot perform merge.")
        return
    
    correct_dico = {}
    for element in name_dico:
        name = name_dico[element]
        for code in code_dico:
            if code_dico[code][0] == name:
                correct_dico[element] = {
                    "name": name,
                    "code": code
                }
                break
    
    try:
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(correct_dico, f, ensure_ascii=False, indent=4)
        print(f"Merged dictionary successfully written to {output_file_path}")
    except Exception as e:
        print(f"Error writing merged dictionary to file: {e}")

if __name__ == "__main__":

    merger(
        input_file_path_name="visualization/src/data/N890_LIB",
        input_file_path_code="data/LIB_MOD_convert",
        output_file_path="test_result/dico_tuple_N890_merged.json"
    )

    """
    input_path = "data/FDS_COMEXTBOIS"
    output_folder_data = "test_result/"
    output_folder_dico = "test_result/"
    start_year = 2012
    end_year = 2025
    
    data, header = compresser.open_files(input_path, start_year, end_year)

    columns = ["N890_MOD", "N890_LIB"]

    newData = compresser.correcter_N890(data, header)

    dico_tuple = dico_columns_tuple(newData, header, columns)
    print(f"Dictionary of tuples for columns {columns}: {dico_tuple}")

    compresser.json_output_file(output_folder_dico +"dico_tuple_N890_3.json", dico_tuple)
    """