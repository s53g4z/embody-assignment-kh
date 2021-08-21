from flask import Flask as fl
from flask import render_template as rt
import sqlite3
from flask import g
from flask import request as rq

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

def getDB():
	db = getattr(g, "_database", None);
	if db is None:
		db = g._database = sqlite3.connect(db_path)
	db.row_factory = sqlite3.Row
	return db

@app.route("/private/gettracklisting")
def tracklisting(name = None):
	db = getDB()
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

@app.route("/private/getcomments")
def comments(name = None):
	db = getDB()
	cur = db.cursor()
	dict = {}
	for row in cur.execute("select * from comments1"):
		dict.update({
			row[0]: {
				"nam": row[1],
				"comment": row[2],
				"timestamp": row[3],
			}
		})
	return dict

@app.route("/private/setcomment", methods=["POST"])
def comment(name = None):
	if rq.method == "POST":
		json = rq.get_json(force=True);
		if "nam" in json and "comment" in json and "timestamp" in json:
			db = getDB()
			cur = db.cursor()
			cur.execute("INSERT INTO comments1 (nam,comment,timestamp) " +
				"VALUES (?, ?, ?);",
				(json["nam"], json["comment"], json["timestamp"]))
			db.commit()
		else:
			print("not inserting corrupted POST data")
	return {};
