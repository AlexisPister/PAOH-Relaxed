import json


def path_from_json_data(path):
    with open(path) as file:
        json_data = json.load(file)
    return json_data
