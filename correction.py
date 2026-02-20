import compresser as compresser

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


if __name__ == "__main__":
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