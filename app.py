from flask import Flask as fl
from flask import render_template as rt
import sqlite3
from flask import g

app = fl(__name__)
db_path = "./db"

@app.teardown_appcontext
def close_connection(e):
	db = getattr(g, "_database", None)
	if db is not None:
		db.close();

@app.route("/")
def idx(name = None):
	return rt("idx.html", name=name)

@app.route("/private/gettracklisting")
def tracklisting(name = None):
	db = getattr(g, "_database", None)
	if db is None:
		db = g._database = sqlite3.connect(db_path)
	db.row_factory = sqlite3.Row
	cur = db.cursor()
	dict = {}
	for row in cur.execute("select * from tracks1"):
		dict.update({
			row[0]: {
				"nam": row[1],
				"artist": row[2],
				"picpath": row[3],
				"filepath": row[4]
			}
		})
	return dict
