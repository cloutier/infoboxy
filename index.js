const wiki = require('wikijs').default;
var MediaWiki = require("mediawiki");
const wdk = require('wikidata-sdk')
var bot = new MediaWiki.Bot();
var wtf = require('wtf_wikipedia');
const request = require('request');

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

const wikidataEdit = require('wikidata-edit')(config)

//getInfoboxCode( "Modèle:Infobox_Préfecture_du_Japon")
getInfoboxCode( "Modèle:Infobox_Municipalité_du_Canada")
//getWikicode( "Préfecture_de_Chiba", "24270")
//getInfoboxCode( "batman")
//getInfoboxCode( "montreal")
getAllPagesWithInfobox( "Modèle:Infobox_Préfecture_du_Japon", function (res) {
    //console.log(res);
    console.log(res.length);
})

wtf.fetch('Toronto', 'fr', function(err, doc) {
    var data = doc.infobox(0).data
    console.log(data);
});
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
		    
		    wikidataMatches.push({key: key, prop: prop})
		}
	    }
	});
	console.log(wikidataMatches);
	//console.log(res.body);
    });

}

function getAllPagesWithInfobox(name, sucess) {
    bot.get({ action: "query", list: "embeddedin", eititle: name, eilimit: 500 }).complete(function (response) {
	results = [];
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
