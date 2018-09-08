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
	pageID: Number,
	embeddedIn: Array ,
	lastCheckedExistence: {type: Date, default: Date.now},
	lastCheckedEmbeddedIn: Date,
	lastCrawled: {type: Date, default: Date.now},
	wikidataEnabledKeys: [{_id: false, time:Date,ip:String,country:String}],
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
}

Infobox.find().sort({lastCheckedExistence: -1}).limit(1).then( (res, err) => {
    if (err) 
	console.log(err);

    if ( moment(res[0].lastCheckedExistence).isSame( moment(), "hour" ) ) {
	console.log("no need to update list of infoboxes");
    } else {
	getAllPagesInCategory( "Catégorie:Projet:Infobox/Modèles liés", function (res) {
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
	});

    }

});

//const wikidataEdit = require('wikidata-edit')(config)

// Later will go over every wikidata enabled infobox,
// but let's restrain ourselves right now. 
model = "Modèle:Infobox_Préfecture_du_Japon";
model = "Modèle:Infobox_Municipalité_du_Canada";

getInfoboxCode( model, wikidataProp => {
    wikidataEnabledKeys = new Set();
    wikidataProp.forEach(i => {
	wikidataEnabledKeys.add(i.key);
    });
    console.log(wikidataEnabledKeys);
    // Needs a check to stop if nothing in wikidata
    getAllPagesWithInfobox( model, function (res) {
	res.slice(1, 3).forEach(i => {
	    console.log(i);
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
				// do your thing with those entities data)
				x = entities[Object.keys(entities)[0]];
				prop = wikidataProp.find(x => x.key == index)["prop"];
				console.log(x.id);
				console.log(prop);
				console.log(x.claims[prop]);
				console.log(attr);
				if (attr.data.text == x.claims[prop]) {
				    // Information already in wikidata don't need to be in wikipedia

				    console.log("SAME");
				} else {
				    console.log("DIFFERENT");

				}
			    });
		    }
		}
	    });
	});
	console.log(res.length);
    })

})
//getWikicode( "Préfecture_de_Chiba", "24270")
//getInfoboxCode( "batman")
//getInfoboxCode( "montreal")
/*
getAllPagesWithInfobox( "Modèle:Infobox_Préfecture_du_Japon", function (res) {
    //console.log(res);
    console.log(res.length);
})

wtf.fetch('Toronto', 'fr', function(err, doc) {
    var data = doc.infobox(0).data
    console.log(data);
});
*/
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
function getInfoboxCode(name, success) {
    request('https://fr.wikipedia.org/w/index.php?action=raw&title=' + name, (err, res, body) => {
	if (err) { console.log(err); }
	code = res.body.substring(
	    res.body.indexOf("<includeonly>") + 1, 
	    res.body.indexOf("</includeonly>")
	);
	wikidataMatches = [];
	code.split("\n").forEach( x => {

	    if (x[0] == "|") {
		console.log(x);
		key = x.substring(1, x.indexOf("=")).trim();
		value = x.substring(x.indexOf("=") + 1, x.length).trim();
		if (value.substring(0, 10) == "{{Wikidata") {
		    particle = value.substring(11, value.length);
		    prop = particle.substring(0, particle.indexOf("|"));
		    // What should be done with showonlyqualifier?
		    // What should be done with "divisionX" + "nom de divisionX"?
		    
		    wikidataMatches.push({key: key, prop: prop})
		}
	    }
	});
	success(wikidataMatches);
    });

}

function getAllPagesInCategory(name, sucess) {
    let results = [];
    bot.get({ action: "query", list: "categorymembers", cmtitle: name, cmlimit: 500 }).complete(function (response) {
	results = results.concat(response.query.categorymembers);
	if (response.continue) {
	    query(name, response.continue.cmcontinue);
	} else {
	    sucess(results);
	}
    });
    function query(name, eicontinue) {
	bot.get({ action: "query", list: "categorymembers", cmtitle: name, cmlimit: 500, cmcontinue: eicontinue }).complete(function (response) {
	    results = results.concat(response.query.categorymembers);
	    if (response.continue) {
		query(name, response.continue.cmcontinue);
	    } else {
		sucess(results);
	    }
	});
    }
}

function getAllPagesWithInfobox(name, sucess) {
    let results = [];
    bot.get({ action: "query", list: "embeddedin", eititle: name, eilimit: 500 }).complete(function (response) {
	results = results.concat(response.query.embeddedin);
	if (response.continue) {
	    query(name, response.continue.eicontinue);
	} else {
	    sucess(results);
	}
    });
    function query(name, eicontinue) {
	bot.get({ action: "query", list: "embeddedin", eititle: name, eilimit: 500, eicontinue: eicontinue }).complete(function (response) {
	    results = results.concat(response.query.embeddedin);
	    if (response.continue) {
		query(name, response.continue.eicontinue);
	    } else {
		sucess(results);
	    }
	});
    }
}
