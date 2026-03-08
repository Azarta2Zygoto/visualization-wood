# Modélisation des fluxs de bois

Les données ont été prises parmi celles qui sont mis publiques par [Agreste](https://agreste.agriculture.gouv.fr/agreste-web/disaron/COMEXTBOIS/detail/).

Ce projet consiste en la visualisation interactive de ces données.

## Auteurs

- Clément Petitjean
- Quentin Potiron

## Installation

Pour l'installation de l'application, merci de vous référer au fichier [README.md](./visualization/README.md) que vous trouverez dans le dossier `visualization`.

https://www.d3indepth.com/geographic/

## Données d'entrée

Les données principaux d'entrée sont de 6 types :

- L'année : elle est la même dans toutes les données d'un fichier, le nom du fichier donne l'année des données.
- Le pays (colonne 0).
- Le type de flux (colonne 1) : il y a les exportations, les importations et le type de données, à savoir en volume (en tonnes) ou en argent (en millier d'euros).
- Le mois (colonne 2).
- Le produit (colonne 3).
- La valeur (colonne 4).

En plus de ces données, il y a les données d'agrégation (entre produits et pays) et des données historiques, les données historiques ont été générées avec une pipeline IA, les informations sur cette pipeline sont dans le fichier [Examples_prompt.txt](./Examples_prompt.txt)

## Limites du Projet

Les événements historiques repérés peuvent ne pas expliquer directement les variations d'importation ou d'exportation d'un produit. Il convient d'interpréter les coïncidences temporelles avec prudence : la coïncidence d'un événement et d'une variation ne suffit pas à établir un lien de causalité. Une étude approfondie est nécessaire pour évaluer l'impact réel. Cette visualisation permet d'identifier des événements à étudier davantage, mais ne doit pas être utilisée pour tirer des conclusions définitives.