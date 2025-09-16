from unittest import TestCase
import bipdyngraph.BipDynGraph as BipDynGraph
import bipdyngraph.utils as utils


class TestBipartiteDynGraph(TestCase):
    def setUp(self):
        fp = "../data/Dufournaud_geoloc_1940.json"
        fp2 = "../data/vispubdata_PAOH_affiliation_cleaned_june202.json"

        json_data = utils.path_from_json_data(fp)
        json_data2 = utils.path_from_json_data(fp2)

        self.graph = BipDynGraph.BipartiteDynGraph(json_data)
        self.graph_vispub = BipDynGraph.BipartiteDynGraph(json_data2)


    def test_links(self):
        print(self.graph_vispub.nodes(data=True))

    def test_documents(self):
        documents = self.graph.documents(data=False, with_time=True)
        self.assertTrue(type(documents) == list)
        self.assertTrue(type(documents[0]) == str)

        documents = self.graph.documents(data=True, with_time=True)
        self.assertTrue(type(documents[0][0]) == str)
        self.assertTrue(type(documents[0][1]) == dict)

    def test_person_documents_by_time(self):
        for person in self.graph.persons():
            time_to_documents = self.graph.person_documents_by_time(person)
            for time in time_to_documents:
                self.assertIsInstance(time, int)


