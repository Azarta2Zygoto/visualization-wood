import csv
import numpy as np
import json


def open_files(input_file_path:str, start:int|None, end:int|None, delimiter:str=";") -> tuple[list[list[str]], list[str]]:
    """
    Opens the input and output files for processing.

    Args:
        input_file_path (str): Path to the csv input file (without the file extension).
        start (int|None): The start value for processing if put.
        end (int|None): The end value for processing if put.
        delimiter (str): The delimiter used in the csv files.
    Returns:
        tuple: the values and the headers
    """
    read_files = []
    headers = []
    try: 
        if start is None or end is None:
            input_file = open(f"{input_file_path}.csv", mode='r', newline='', encoding='utf-8', errors='ignore')
            reader = csv.reader(input_file, delimiter=delimiter)
            headers = next(reader)  # Read header only in headers variable
            for line in reader:
                read_files.append(line)
            input_file.close()
            print(f"Successfully opened file {input_file_path}.csv.")

        else:
            for i in range(start, end + 1):
                input_file = open(f"{input_file_path}_{i}.csv", mode='r', newline='', encoding='utf-8', errors='ignore')
                reader = csv.reader(input_file, delimiter=delimiter)
                headers = next(reader)  # Read header only in headers variable
                for line in reader:
                    read_files.append(line)
                input_file.close()
                print(f"Successfully opened file {input_file_path}_{i}.csv.")

    except Exception as e:
        print(f"Error opening files: {e}")

    return read_files, headers


def output_file(
        output_file_path:str,
        data:list[list[str]],
        header:list[str],
        delimiter:str=";",
        file_extensions=["csv", "npz"],
    ) -> None:
    """
    Outputs the processed data to a specified file.

    Args:
        output_file_path (str): Path to the output file (without the extension).
        data (list): The data to write.
        header (list): The header to write.
        file_extensions (list): List of file extensions to output (e.g., ["csv", "npz"]).
        delimiter (str): The delimiter used in the csv file.
    """
    try:
        if "csv" in file_extensions:
            with open(output_file_path+".csv", mode='w', newline='', encoding='utf-8') as output_file:
                writer = csv.writer(output_file, delimiter=delimiter)
                writer.writerow(header)
                writer.writerows(data)
        
        if "npz" in file_extensions:
            np.savez_compressed(output_file_path+'.npz', data=np.array(data, dtype=np.int32))

        print(f"Successfully wrote to {output_file_path}.")
    except Exception as e:
        print(f"Error writing to file: {e}")


def json_output_file(output_file_path:str, data:dict) -> None:
    """
    Outputs the processed data to a specified JSON file.

    Args:
        output_file_path (str): Path to the output file (without the extension).
        data (list): The data to write.
    """
    try:
        with open(output_file_path+".json", mode='w', encoding='utf-8') as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=4)
        print(f"Successfully wrote to {output_file_path}.")
    except Exception as e:
        print(f"Error writing to file: {e}")

def json_list_output_file(output_file_path:str, data:list) -> None:
    """
    Outputs the processed data to a specified JSON file.

    Args:
        output_file_path (str): Path to the output file (without the extension).
        data (list): The data to write.
    """
    try:
        with open(output_file_path+".json", mode='w', encoding='utf-8') as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=4)
        print(f"Successfully wrote to {output_file_path}.")
    except Exception as e:
        print(f"Error writing to file: {e}")


def revert_dict(dico:dict) -> dict:
    """
    Reverts the keys and values of a dictionary.

    Args:
        dico (dict): the input dict.
    Returns:
        revert_dico (dict): The reverted dictionary.
    """
    revert_dico = {}
    for key, value in dico.items():
        revert_dico[value] = key
    return revert_dico


def count_distinct_elements(data:list[list[str]], column_index:int) -> tuple[set, int]:
    """
    Counts distinct elements in a specified column of the data.

    Args:
        data (list): The data to process.
        column_index (int): The index of the column to count distinct elements from.

    Returns:
        tuple: A set of distinct elements and their count.
    """
    distinct_elements = set()
    for row in data:
        if len(row) > column_index:
            distinct_elements.add(row[column_index])
    return distinct_elements, len(distinct_elements)

def count_all_columns(data:list[list[str]])->list[int]:
    """
    Counts occurrences of elements in all columns of the data.

    Args:
        data (list): The data to process.
    Returns:
        list: A list with counts of distinct elements for each column.
    """
    if not data:
        return []

    count_columns = []

    for col_index in range(len(data[0])):
        count_columns.append(count_distinct_elements(data, col_index)[1])

    return count_columns

def count_element_in_column(data:list[list[str]], column_index:int, element:str)->int:
    """
    Counts occurrences of a specific element in a specified column of the data.

    Args:
        data (list): The data to process.
        column_index (int): The index of the column to search.
        element (str): The element to count.
    Returns:
        int: The count of occurrences of the element.
    """
    count = 0
    for row in data:
        if len(row) > column_index and row[column_index] == element:
            count += 1
    return count

def erased_one_column(data:list[list[str]], header:list[str], column_value:str|list[str])->tuple[list[list[str]], list[str]]:
    """
    Erases a specified column.

    Args:
        data (list): The data to process.
        column_value (str|list[str]): The column name(s) to erase.

    Returns:
        list: The modified data with rows containing the value removed.
    """
    column_indexes:list[int] = []
    if isinstance(column_value, str):
        column_index = header.index(column_value)
        column_indexes.append(column_index)
    else:
        for col_value in column_value:
            column_index = header.index(col_value)
            column_indexes.append(column_index)

    new_data = []
    for element in data:
        sub_element = []
        for i, value in enumerate(element):
            if i not in column_indexes:
                sub_element.append(value)
        new_data.append(sub_element)

    new_header = []
    for i, hd in enumerate(header):
        if i not in column_indexes:
            new_header.append(hd)
    return new_data, new_header

def erased_one_value_column(data:list[list[str]], header:list[str], column_indexes:list[int])->tuple[list[list[str]], list[str]]:
    """
    Erases columns with distinct elements less than or equal to 1.

    Args:
        data (list): The data to process.
        header (list[str]): The header of the data.
        column_indexes (list[int]): The list of distinct element counts for each column.

    Returns:
        list: The modified data with rows containing the value removed.
    """
    new_data = []
    for element in data:
        sub_element = []
        for i, value in enumerate(element):
            if column_indexes[i] > 1:
                sub_element.append(value)
        new_data.append(sub_element)

    new_header = []
    for i, hd in enumerate(header):
        if column_indexes[i] > 1:
            new_header.append(hd)
    
    return new_data, new_header

def indexation_columns(
        data:list[list[str]],
        header:list[str],
        output_file_name:str,
        dico_folder:str="",
        max_limit=250,
    )->list[list[str]]:
    """
    Indexes columns with distinct elements exceeding a maximum limit.

    Args:
        data (list): The data to process.
        header (list): The header of the data.
        output_file_name (str): The base name for output files.
        max_limit (int): The maximum limit for distinct elements.

    Returns:
        list: The modified data with indexed columns.
    """
    if not data:
        return data

    num_columns = len(data[0])
    count_colum = count_all_columns(data)
    indexes = [col_index for col_index in range(num_columns) if count_colum[col_index] < max_limit]
    dicos: list[dict[str, int]] = [{} for _ in range(num_columns)]

    indexed_data = []
    for row in data:
        new_row = []
        for col_index, value in enumerate(row):
            if col_index in indexes:
                if value not in dicos[col_index]:
                    L = len(dicos[col_index])
                    dicos[col_index][value] = L
                    new_row.append(str(L))
                else:
                    new_row.append(str(dicos[col_index][value]))
            else:
                new_row.append(value)
        indexed_data.append(new_row)

    json_list_output_file(dico_folder+"header", header)
    for i, dico in enumerate(dicos):
        if len(dico) > 0:
            revert_dico = revert_dict(dico)
            output_file_name_dico = header[i]
            json_output_file(output_file_name_dico, revert_dico)
            print(f"Output dictionary for column {i} to {output_file_name_dico}.json")

    output_file(output_file_name, indexed_data, header)
    return indexed_data



def multiple_indexation_columns(
        data:list[list[str]],
        header:list[str],
        output_file_name:str,
        dico_folder:str="",
        col_multiple:str = "ANNREF",
        export_dico:bool=True,
        max_limit=250,
    )->list[list[list[str]]]:
    """
    Indexes columns with distinct elements exceeding a maximum limit.

    Args:
        data (list): The data to process.
        header (list): The header of the data.
        output_file_name (str): The base name for output files.
        dico_folder (str): The folder to save dictionaries.
        col_multiple (str): The column name used for multiple indexing.
        max_limit (int): The maximum limit for distinct elements.

    Returns:
        list: The modified data with indexed columns.
    """
    if not data:
        return [data]

    # Initialisation des valeurs
    num_columns = len(data[0])
    count_colum = count_all_columns(data)
    indexes = [col_index for col_index in range(num_columns) if count_colum[col_index] < max_limit]
    dicos: list[dict[str, int]] = [{} for _ in range(num_columns)]

    iter = 0
    col_multiple_index = header.index(col_multiple)
    first_file_number = int(data[0][col_multiple_index])
    file_number = int(data[0][col_multiple_index])

    indexed_data:list[list[list[str]]] = []
    new_file:list[list[str]] = []
    while iter < len(data):
        new_row = []
        row = data[iter]

        # Check if we need to start a new file
        first_value = int(row[0])
        if first_value != file_number:
            indexed_data.append(new_file)
            new_file = []
            file_number += 1

        for col_index, value in enumerate(row):
            # Skip the multiple index column
            if col_index != col_multiple_index:
                if col_index in indexes:
                    if value not in dicos[col_index-1]:
                        L = len(dicos[col_index-1])
                        dicos[col_index-1][value] = L
                        new_row.append(str(L))
                    else:
                        new_row.append(str(dicos[col_index-1][value]))
                else:
                    new_row.append(value)
        new_file.append(new_row)
        iter += 1
    indexed_data.append(new_file)

    # Output dictionaries
    header = header[:col_multiple_index] + header[col_multiple_index+1:]
    json_list_output_file(dico_folder+"header", header)

    if export_dico:
        for i, dico in enumerate(dicos):
            if len(dico) > 0:
                revert_dico = revert_dict(dico)
                output_file_name_dico = header[i]
                json_output_file(dico_folder+output_file_name_dico, revert_dico)
                print(f"Output dictionary for column {i} to {output_file_name_dico}.json")

    # Output indexed files
    for index, file_data in enumerate(indexed_data):
        output_file(output_file_name+"_"+str(first_file_number+index), file_data, header, file_extensions=["npz"])
    return indexed_data


if __name__ == "__main__":
    input_path = "data/FDS_COMEXTBOIS"
    output_folder_data = "visualization/public/data/"
    output_folder_dico = "visualization/src/data/"
    start_year = 2012
    end_year = 2025

    data, header = open_files(input_path, start_year, end_year)
    print(data[0], header)
    distinct_elements, distinct_count = count_distinct_elements(data, 2)
    print(f"Distinct elements in column 2: {distinct_elements} in total {distinct_count}")
    specific_count = count_element_in_column(data, 0, "NOM")
    print(f"Occurrences of 'NOM' in column 0: {specific_count}")

    new_data, new_header = erased_one_column(data, header, ["GEOGRAPHIE_LIB", "N027_MOD", "N053_MOD", "N890_MOD"])
    print(f"Data after erasing column 3: {new_data[0]}, New Header: {new_header}")

    all_count = count_all_columns(new_data)
    print(f"Distinct counts for all columns: {all_count}")

    new_data, new_header = erased_one_value_column(new_data, new_header, all_count)
    print(f"Data after erasing values in columns with <=1 distinct elements: {new_data[0]}, New Header: {new_header}")

    multiple_indexation_columns(
        new_data,
        new_header,
        output_folder_data+"data",
        dico_folder=output_folder_dico,
        col_multiple="ANNREF",
        max_limit=250
    )
