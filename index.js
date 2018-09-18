const wiki = require('wikijs').default;
var MediaWiki = require("mediawiki");
const wdk = require('wikidata-sdk')
var bot = new MediaWiki.Bot();
var wtf = require('wtf_wikipedia');
const request = require('request');
const breq = require('bluereq');
const mongoose = require('mongoose');
const moment= require("moment");

mongoose.connect('mongodb://localhost/infoboxy',  { useNewUrlParser: true });
var db = mongoose.connection;

const Infobox = mongoose.model(
    'Infobox',
    {
	title: String,
	code: String,
	pageID: Number,
	embeddedIn: Array ,
	lastCheckedExistence: {type: Date, default: Date.now},
	wiki: {type: String, default: "fr"},
	lastCheckedEmbeddedIn: Date,
	lastCrawled: {type: Date },
	wikidataEnabledKeys: Array,
    }
);

const Key = mongoose.model(
    'Key',
    {
	key: String,
	ref: Number,
	pcodes: Array,
    }
);
const Suggestion = mongoose.model(
    'Suggestion',
    {
	type: String,
	line: String,
	qcode: String,
	pcode: String,
	boxEntry: String,
	wikidataValue: String,
	wikipediaValue: String,
	pageID: Number,
	generated: {type: Date, default: Date.now},
    }
);

bot.settings.endpoint = "https://fr.wikipedia.org/w/api.php";
bot.settings.userAgent = "Infoboxy <https://fr.wikipedia.org/wiki/Utilisateur:Vincent_cloutier>";

const config = {
  // One authorization mean is required

  // either a username and password
  username: 'my-wikidata-username',
  password: 'my-wikidata-password',

  // Optional
  verbose: true, // Default: false
  userAgent: 'my-project-name/v3.2.5 (https://project.website)' // Default: `wikidata-edit/${pkg.version} (https://github.com/maxlath/wikidata-edit)`
};
(async () => {

    // We find all infoboxes and store them
    res = await Infobox.find().sort({lastCheckedExistence: -1}).limit(1);
    if (res.length != 0 && moment(res[0].lastCheckedExistence).isSame( moment(), "month" ) ) {
	console.log("no need to update list of infoboxes");
    } else {
	res = await getAllPagesInCategory( "Catégorie:Projet:Infobox/Modèles liés")
	console.log(res);
	res.forEach(i => {
	    const infobox = {
		title: i.title,
		pageID: i.pageid,
		lastCheckedExistence: Date.now()
	    };
	    Infobox.findOneAndUpdate({pageID: i.pageid}, infobox, {upsert:true}, function(err, doc){

		if (err) {
		    console.error(err);
		}
		console.log("Found infobox template: " + i.title);
	    });


	});

    }

    // We find all the wikidata keys in an infobox
    infoboxesToCrawl = await Infobox.find()//.limit(5);
    for (let infobox of infoboxesToCrawl) { 
	infobox.wikidataEnabledKeys = await getInfoboxCode(infobox.title);
	infobox.wikidataEnabledKeys.forEach(i => {
	    Key.updateOne({key: i.key}, {$inc: {"ref": 1, ["pcodes." + i.prop]: 1}}, {upsert: true}).exec();
	});
	infobox.lastCrawled = new Date();
	infobox.save();
	console.log("Fetched " + infobox.wikidataEnabledKeys.length + " wikidata keys for infobox: " + infobox.title);
    }
    
    // We find all the pages that contain a specific infobox
    infoboxesToCrawl = await Infobox.find();
    infoboxesToCrawl = await Infobox.find({embeddedIn: {$exists: false}}).limit(1);
    for (let infobox of infoboxesToCrawl) { 
	infobox.embeddedIn = await getAllPagesWithInfobox( infobox.title);
	infobox.lastCheckedEmbeddedIn = new Date();
	infobox.save();
	console.log("Fetched " + infobox.embeddedIn.length + " pages containing infobox: " + infobox.title);
    }

    // We then go over all infobox with wikidata
    infoboxesToCrawl = await Infobox.aggregate([
	{$match: {wikidataEnabledKeys: {$ne: []}}},
	{$unwind: "$embeddedIn"}
    ]);

    //keys -> tuple
    for (infobox of infoboxesToCrawl) {
	wikidataEnabledKeysSet = new Set();
	infobox.wikidataEnabledKeys.forEach(i => {
	    wikidataEnabledKeysSet.add(i.key);
	});
	console.log(wikidataEnabledKeysSet);
	pageTitle = infobox.embeddedIn.title;
	console.log(pageTitle);
	doc = await wtf.fetch(pageTitle, 'fr');
	var data = doc.infobox(0).data
	for(let index in data) { 
	    let attr = data[index]; 
	    if (wikidataEnabledKeysSet.has(index)) {
		var url = wdk.getWikidataIdsFromWikipediaTitles({
		    titles: pageTitle,
		    sites: 'frwiki',
		    languages: ['en', 'fr'],
		    props: ['info', 'claims']
		})
		breq.get(url)
		    .then(res => {
			const { entities } = res.body
			return wdk.simplify.entities(entities)
		    })
		    .then(entities => {
			x = entities[Object.keys(entities)[0]];
			prop = infobox.wikidataEnabledKeys.find(x => x.key == index)["prop"];
			if (prop.length == 0)
			    return;
			console.log("aoiwefj " + prop.length)
			console.log(x.id);
			console.log(index);
			console.log(prop);
			console.log(x.claims[prop]);
			console.log(attr);
			if (attr.data.text == x.claims[prop]) {
			    // Information already in wikidata don't need to be in wikipedia

			    const suggestion = new Suggestion({
				type: "REMOVE_FROM_WIKI",
				pageID: i.pageid,
				qcode: x.id,
				pcode: prop,
				wikidataValue: x.claims[prop],
				wikipediaValue: attr.data.text,
				boxEntry: index,
			    });
			    suggestion.save(function(err){

				if (err) {
				    console.error(err);
				}
				console.log("SAME");
			    });
			} else {
			    console.log("DIFFERENT");

			}
		    });
	    }
	}
    }
})();

//const wikidataEdit = require('wikidata-edit')(config)

// Later will go over every wikidata enabled infobox,
// but let's restrain ourselves right now. 
model = "Modèle:Infobox_Municipalité_du_Canada";
model = "Modèle:Infobox_Préfecture_du_Japon";

getInfoboxCode( model).then( wikidataProp => {
    return;
    wikidataEnabledKeys = new Set();
    wikidataProp.forEach(i => {
	wikidataEnabledKeys.add(i.key);
    });
    console.log(wikidataEnabledKeys);
    // Needs a check to stop if nothing in wikidata
    getAllPagesWithInfobox( model ).then( function (res) {
	//res.slice(1, 3).forEach(i => {

	res.forEach(i => {
	    //console.log(i);
	    pageTitle = i.title;
	    wtf.fetch(pageTitle, 'fr', function(err, doc) {
		var data = doc.infobox(0).data
		for(let index in data) { 
		    let attr = data[index]; 
		    if (wikidataEnabledKeys.has(index)) {
			var url = wdk.getWikidataIdsFromWikipediaTitles({
			    titles: pageTitle,
			    sites: 'frwiki',
			    languages: ['en', 'fr'],
			    props: ['info', 'claims']
			})
			breq.get(url)
			    .then(res => {
				const { entities } = res.body
				return wdk.simplify.entities(entities)
			    })
			    .then(entities => {
				x = entities[Object.keys(entities)[0]];
				prop = wikidataProp.find(x => x.key == index)["prop"];
				console.log(x.id);
				console.log(index);
				console.log(prop);
				console.log(x.claims[prop]);
				console.log(attr);
				if (attr.data.text == x.claims[prop]) {
				    // Information already in wikidata don't need to be in wikipedia

				    const suggestion = new Suggestion({
					type: "REMOVE_FROM_WIKI",
					pageID: i.pageid,
					qcode: x.id,
					pcode: prop,
					wikidataValue: x.claims[prop],
					wikipediaValue: attr.data.text,
					boxEntry: index,
				    });
				    suggestion.save(function(err){

					if (err) {
					    console.error(err);
					}
					console.log("SAME");
				    });
				} else {
				    console.log("DIFFERENT");

				}
			    });
		    }
		}
	    });
	});
    })

})

function getPageInfobox(name) {
    wiki({ apiUrl: 'https://fr.wikipedia.org/w/api.php' }).page(name)
	.then(page => page.fullInfo())
	.then(console.log); // Bruce Wayne

}
function getWikicode(name, pageid) {
    bot.get({ action: "query", titles: name, "prop": "revisions", rvprop: "content", "rvslots": "main" }).complete(function (response) {
	console.log(response)
	console.log(response.query.pages)
	console.log(response.query.pages["-1"].revisions[0].slots.main["*"])
    });

}
function getInfoboxCode(name) {
    return new Promise( (resolve, reject) => {
	request('https://fr.wikipedia.org/w/index.php?action=raw&title=' + encodeURIComponent(name), (err, res, body) => {
	    if (err) { console.log(err); }
	    code = res.body.substring(
		res.body.indexOf("<includeonly>") + 1, 
		res.body.indexOf("</includeonly>")
	    );
	    wikidataMatches = [];
	    code.split("\n").forEach( x => {

		if (x[0] == "|") {
		    key = x.substring(1, x.indexOf("=")).trim();
		    value = x.substring(x.indexOf("=") + 1, x.length).trim();
		    if (value.substring(0, 10) == "{{Wikidata") {
			particle = value.substring(11, value.length);
			prop = particle.substring(0, particle.indexOf("|"));
			// What should be done with showonlyqualifier?
			// Check if there is a showonlyqualifier + its raw prop

			
			// What should be done with "divisionX" + "nom de divisionX"?

			wikidataMatches.push({key: key, prop: prop})
		    }
		}
	    });
	    resolve(wikidataMatches);
	});
    });

}

function getAllPagesInCategory(name) {
    return new Promise( (resolve, reject) => {
	let results = [];
	bot.get({ action: "query", list: "categorymembers", cmtitle: name, cmlimit: 500 }).complete(function (response) {
	    results = results.concat(response.query.categorymembers);
	    if (response.continue) {
		query(name, response.continue.cmcontinue);
	    } else {
		resolve(results);
	    }
	});
	function query(name, eicontinue) {
	    bot.get({ action: "query", list: "categorymembers", cmtitle: name, cmlimit: 500, cmcontinue: eicontinue }).complete(function (response) {
		results = results.concat(response.query.categorymembers);
		if (response.continue) {
		    query(name, response.continue.cmcontinue);
		} else {
		    resolve(results);
		}
	    });
	}
    });
}

function getAllPagesWithInfobox(name) {
    return new Promise( (resolve, reject) => {
	let results = [];
	bot.get({ action: "query", list: "embeddedin", eititle: name, eilimit: 500 }).complete(function (response) {
	    results = results.concat(response.query.embeddedin);
	    if (response.continue) {
		query(name, response.continue.eicontinue);
	    } else {
		resolve(results);
	    }
	});
	function query(name, eicontinue) {
	    bot.get({ action: "query", list: "embeddedin", eititle: name, eilimit: 500, eicontinue: eicontinue }).complete(function (response) {
		results = results.concat(response.query.embeddedin);
		if (response.continue) {
		    query(name, response.continue.eicontinue);
		} else {
		    resolve(results);
		}
	    });
	}
    });
}
