import csv
import numpy as np

def open_files(input_file_path:str, start_year:int, end_year:int) -> tuple[list[list[str]], list[str]]:
    """
    Opens the input and output files for processing.

    Args:
        input_file_path (str): Path to the input file.
        start_year (int): The starting year for processing.
        end_year (int): The ending year for processing.
    Returns:
        tuple: the values and the headers
    """
    read_files = []
    headers = []
    try: 
        for i in range(start_year, end_year + 1):

            input_file = open(f"{input_file_path}_{i}.csv", mode='r', newline='', encoding='utf-8', errors='ignore')
            reader = csv.reader(input_file, delimiter=";")
            headers = next(reader)  # Read header only in headers variable
            for line in reader:
                read_files.append(line)
            input_file.close()
            print(f"Successfully opened files of {i}.")

    except Exception as e:
        print(f"Error opening files: {e}")

    return read_files, headers

def output_file(output_file_path:str, data:list[list[str]], header:list[str]) -> None:
    """
    Outputs the processed data to a specified file.

    Args:
        output_file_path (str): Path to the output file.
        data (list): The data to write.
        header (list): The header to write.
    """
    try:
        with open(output_file_path+".csv", mode='w', newline='', encoding='utf-8') as output_file:
            writer = csv.writer(output_file, delimiter=';')
            writer.writerow(header)
            writer.writerows(data)
            np.savez_compressed('ints.npz', data=np.array(data, dtype=np.int32))

        print(f"Successfully wrote to {output_file_path}.")
    except Exception as e:
        print(f"Error writing to file: {e}")

def json_output_file(output_file_path:str, data:dict) -> None:
    """
    Outputs the processed data to a specified JSON file.

    Args:
        output_file_path (str): Path to the output file.
        data (list): The data to write.
    """
    import json
    try:
        with open(output_file_path, mode='w', encoding='utf-8') as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=4)
        print(f"Successfully wrote to {output_file_path}.")
    except Exception as e:
        print(f"Error writing to file: {e}")


def count_distinct_elements(data, column_index)->tuple[set, int]:
    """
    Counts distinct elements in a specified column of the data.

    Args:
        data (list): The data to process.
        column_index (int): The index of the column to count distinct elements from.

    Returns:
        tuple: A set of distinct elements and the count of distinct elements.
    """
    distinct_elements = set()
    for row in data:
        if len(row) > column_index:
            distinct_elements.add(row[column_index])
    return distinct_elements, len(distinct_elements)

def count_all_columns(data)->list[int]:
    """
    Counts occurrences of elements in all columns of the data.

    Args:
        data (list): The data to process.
    Returns:
        list: A list with counts of distinct elements for each column.
    """
    if not data:
        return []

    num_columns = len(data[0])
    counts = [0] * num_columns

    for col_index in range(num_columns):
        counts[col_index] = count_distinct_elements(data, col_index)[1]

    return counts

def count_element_in_column(data, column_index, element)->int:
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

def erased_one_column(data:list[list[str]], header:list[str], column_index:int)->tuple[list[list[str]], list[str]]:
    """
    Erases a specified column.

    Args:
        data (list): The data to process.
        column_index (int): The index of the column to check.

    Returns:
        list: The modified data with rows containing the value removed.
    """
    new_data = []
    for element in data:
        sub_element = []
        for i, value in enumerate(element):
            if i != column_index:
                sub_element.append(value)
        new_data.append(sub_element)

    new_header = []
    for i, hd in enumerate(header):
        if i != column_index:
            new_header.append(hd)
    return new_data, new_header

def erased_one_value_column(data:list[list[str]], header:list[str], column_indexes:list[int])->tuple[list[list[str]], list[str]]:
    """
    Erases rows with a specific value in a specified column.

    Args:
        data (list): The data to process.
        column_index (list[int]): The index of the column to check.

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
        max_limit=250
    )->list[list[str]]:
    """
    Indexes columns with distinct elements exceeding a maximum limit.

    Args:
        data (list): The data to process.
        max_limit (int): The maximum limit for distinct elements.

    Returns:
        list: The modified data with indexed columns.
    """
    if not data:
        return data

    num_columns = len(data[0])
    count_colum = count_all_columns(data)
    indexes = [col_index for col_index in range(num_columns) if count_colum[col_index] < max_limit]
    print(f"Indexing columns: {indexes}", count_colum)
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

    for dico in dicos:
        if len(dico) > 0:
            output_file_name_dico = f"{output_file_name}_col{dicos.index(dico)}_dict.json"
            json_output_file(output_file_name_dico, dico)
    output_file(output_file_name, indexed_data, header)
    return indexed_data



if __name__ == "__main__":
    input_path = "data/FDS_COMEXTBOIS"
    start_year = 2012
    end_year = 2025

    data, header = open_files(input_path, start_year, end_year)
    print(data[0], header)
    distinct_elements, distinct_count = count_distinct_elements(data, 2)
    print(f"Distinct elements in column 2: {distinct_elements} in total {distinct_count}")
    specific_count = count_element_in_column(data, 0, "NOM")
    print(f"Occurrences of 'NOM' in column 0: {specific_count}")

    new_data, new_header = erased_one_column(data, header, 3)
    print(f"Data after erasing column 3: {new_data[0]}, New Header: {new_header}")

    all_count = count_all_columns(new_data)
    print(f"Distinct counts for all columns: {all_count}")

    new_data, new_header = erased_one_value_column(new_data, new_header, all_count)
    print(f"Data after erasing values in columns with <=1 distinct elements: {new_data[0]}, New Header: {new_header}")

    # output_path = "compressed_output.csv"
    # output_file(output_path, new_data, new_header)

    new_data = indexation_columns(new_data, new_header, "result/indexed_compressed_output", max_limit=250)
