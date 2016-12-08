# 311plus
A custom download tool for NYC 311 data, built with CartoDB.  View it live at [http://chriswhong.github.io/311plus](http://chriswhong.github.io/311plus)

About
=====

NYC Publishes 311 data on a daily basis on the [open data portal](http://data.cityofnewyork.us).  The 2010 to present dataset contains over 7 million rows, and is a very large download.  This tool was built to give you quick access to a smaller geographic slice of the data in various map-ready formats.

For now, this tool only contains data from the past 30 days. It is updated via a cartoDB sync table from [a proxy API endpoint that queries the last 30 days of data](https://github.com/chriswhong/nyc311proxy). This is just a start, and I will extend the date range if there is demand for it.

Data can be exported as geoJSON, zipped shapefile, and CSV, or can be imported directly to your cartoDB account. Geometries are exported in WGS84 (Latitude and Longitude).
If you like this project, or if you hate it, let me know by tweeting to @chris_whong.  Pull requests are welcomed! This project was built with the CartoDB web mapping platform, and is based on a [similar tool built for PLUTO tax lot data](http://chriswhong.github.io/plutoplus) 
Support open Data!
