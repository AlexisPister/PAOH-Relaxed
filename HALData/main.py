import requests
import json

# This script retrieves the publications published by Inria authors which are part of a team inside the TEAMS array.
# Modify the TIMES array to select the timeframe of the search
# WARNING: all authors from other affiliations of Inria are removed from the dataset.
# The data generated is only indicative of the internal Inria collaborations.



# api-endpoint
# URL = "https://api.archives-ouvertes.fr/search/?q=rteamStructAcronym_s:AVIZ&fl=rteamStructAcronym_s,halId_s,authFullNameIdFormPerson_fs,publicationDate_s&wt=json&indent=true&fq=publicationDateY_i:[2020%20TO%202023]"
URL = "https://api.archives-ouvertes.fr/search"


# LARGE
# TEAMS = ['AVIZ', "CELESTE", "DATASHAPE", 'IN-SITU', "EX-SITU", "FAIRPLAY", "ILDA", "SODA", "TAU", "PARIETAL"]
# TIMES = [2006, 2022]

# MEDIUM LARGE
# TIMES = [2010, 2020]
# TEAMS = ["SHACRA", "MINT", "DEFROST", "MJOLNIR", "MIMESIS"]

# MEDIUM SMALL
# TIMES = [2011, 2014]
# TEAMS = ["PLANETE", "PRIVATICS", "DIANA"]

# SMALL
# TIMES = [2007, 2010]
# TEAMS = ["PARIETAL"]

# TEAMS = ['AVIZ', "EX-SITU", "ILDA"]
# TIMES = [2019, 2023]



TEAMS = ['AVIZ', "CELESTE", "DATASHAPE", 'IN-SITU', "EX-SITU", "FAIRPLAY", "ILDA", "SODA", "TAU", "PARIETAL"]
TIMES = [1900, 2050]



# defining a params dict for the parameters to be sent to the HAL API
# PARAMS = {'address': location}
PARAMS = {
            # "q": f"rteamStructAcronym_s:({' OR '.join(TEAMS)})",
            # "q": f"rteamStructAcronym_s:({' OR '.join(TEAMS)})",
          "fl": "rteamStructAcronym_s,halId_s,authFullNameIdFormPerson_fs,authIdHasPrimaryStructure_fs,authIdHasStructure_fs,publicationDate_s,rteamStructId_i",
          "wt": "json",
         "indent": "true",
         "rows": "10000",
         "fq": f"publicationDateY_i:[{TIMES[0]} TO {TIMES[1]}]"}

# sending get request and saving the response as response object
r = requests.get(url=URL, params=PARAMS)


def process(json_data):
    N = json_data["response"]["numFound"]
    docs = json_data["response"]["docs"]
    paoh_json = to_paoh_json(docs)

    # print(N, len(docs))

    fn = f"inria_{len(TEAMS)}_{TIMES[0]}_{TIMES[1]}.json"
    with open(fn, "w+") as f:
        json.dump(paoh_json, f)

    with open("inria.json", "w+") as f:
        json.dump(paoh_json, f)


def to_paoh_json(docs):
    graph_json = {}
    graph_json["metadata"] = {
        "datasetName": "test",
        "name": "name",
        "nodes": "nodes",
        "links": "links",
        "source_entity_type": "document",
        "target_entity_type": "person",
        "time_slot": "ts",
        "format": "2.1.0",
        "entity_type": "label",
        "teams": TEAMS,
        "community": ["team"]
    }

    nodes = []
    links = []
    all_years = []

    nodes_ids_visited = []
    nodeid_to_node = {}

    pdict = {}

    for doc in docs:
        auths = doc["authFullNameIdFormPerson_fs"]
        doc_id = doc["halId_s"]
        time = doc["publicationDate_s"]
        all_orgas = doc["authIdHasStructure_fs"]
        year = find_year(time)

        if year not in all_years:
            all_years.append(year)

        print(doc)
        inria_teams = doc["rteamStructAcronym_s"]
        inria_teams2 = doc["rteamStructId_i"]

        # print(0, auths)
        # print(1, inria_teams)
        # print(2, inria_teams2)
        # print(3, all_orgas)

        id_to_inria_team = {b:a for a, b in zip(inria_teams, inria_teams2)}
        # print(id_to_inria_team)

        orgas_persons = [parse_orgas_field(x) for x in all_orgas]

        n = 0
        new_links = []
        for person in auths:
            name, _, p_id = person.split("_")
            orgas = [x[1] for x in orgas_persons if x[0] == p_id]

            is_inria = len([x for x in orgas if "inria" in x.lower() or "Institut National de Recherche en Informatique et en Automatique" in x]) > 0
            if not is_inria:
                continue

            # Find the inria team
            for org in all_orgas:
                if p_id in org:
                    for inria_team_id, inria_team in id_to_inria_team.items():
                        if str(inria_team_id) in org:
                            p_inria_team = inria_team


            # Using only the first number remove cases of duplications.
            # This needs to be done only know though because the full ID is used to find the organization
            p_id = p_id.split("-")[0]

            if p_id in pdict:
                p_id = pdict[p_id]
            else:
                l = len(pdict)
                pdict[p_id] = l
                p_id = l

            link = {
                "source": doc_id,
                "target": p_id,
                "ts": year,
                "team": p_inria_team
            }
            # links.append(link)
            new_links.append(link)

            n += 1

            if p_id not in nodes_ids_visited:
                nodes_ids_visited.append(p_id)
                person_node = {
                    "id": p_id,
                    "name": name,
                    "label": "person",
                    "team": [{
                        "ts": year,
                        "team": p_inria_team
                    }]
                }

                nodeid_to_node[p_id] = person_node
                nodes.append(person_node)
            else:
                node_data = nodeid_to_node[p_id]["team"]
                years = [n["ts"] for n in node_data]
                if year not in years:
                    node_data.append({
                        "ts": year,
                        "team": p_inria_team
                    })

        if n > 1:
            link_node = {
                "id": doc_id,
                "ts": year,
                "label": "document",
            }
            nodes.append(link_node)

            for link in new_links:
                links.append(link)

    all_years.sort()

    # Save the team for each person at each year in a list
    for node in nodes:
        if node["label"] != "person":
            continue

        teams = []
        for year in all_years:
            found = False
            for team in node["team"]:
                if team["ts"] == year:

                    # This condition is to discard any team value that is not part of the TEAMS list
                    if team["team"] in TEAMS:
                        teams.append(team["team"])
                        found = True
                        break

            if not found:
                teams.append(None)

        node["team"] = teams



    persons = [n for n in nodes if n["label"] == "person"]
    docs = [n for n in nodes if n["label"] == "document"]

    print(len(persons), " PERSONS")
    print(len(docs), " HYPEREDGES")
    print(len(links), " CONNECTIONS")
    print(len(links) / len(docs), " MEAN HSIZE")
    print(len(all_years), " YEARS")
    print(len(TEAMS), " TEAMS")

    graph_json["nodes"] = nodes
    graph_json["links"] = links
    return graph_json


def parse_orgas_field(orga_field):
    # person_id, _, name, __, docid, ___, orga = orga_field.split("_")
    split = orga_field.split("_")
    person_id = split[0]
    orga = split[6]

    return person_id, orga


def find_year(time):
    if len(time) == 4:
        return time
    return time[:4]


if __name__ == '__main__':
    process(r.json())
