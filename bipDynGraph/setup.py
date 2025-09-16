import setuptools

PACKAGES = [
    'bipdyngraph'
]

setuptools.setup(
    name="bipdyngraph",
    version="1.0.0",
    author="Alexis Pister",
    author_email="alexis.pister@hotmail.com",
    url="https://gitlab.inria.fr/apister/bipdyngraph",
    license="MIT",
    description="dynamic bipartite graph package",
    packages=setuptools.find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.8',
    install_requires=[
        "networkx",
        "pydot",
        "beautifulsoup4"
    ],
)
