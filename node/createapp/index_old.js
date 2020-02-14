// Imports the Google Cloud client library
const Firestore = require('@google-cloud/firestore');
const { DNS } = require('@google-cloud/dns');
var request = require("request");
var recursive = require("recursive-readdir");
var http = require('http');
var fs = require('fs');
var unzipper = require('unzipper')

// This will be the function that gets kicked off in Google Cloud functions. We won't use 
// when developing locally, but rather the function localTesting()
exports.main = (event, context) => {
  const resource = context.resource;
  // log out the resource string that triggered the function
  console.log('Function triggered by change to: ' + resource);
  // now log the full event object
  console.log(JSON.stringify(event));

  var firstName = event.value.fields.firstName.stringValue;
  var companyName = event.value.fields.companyName.stringValue;
  console.log(firstName);
  console.log("Formatted string " + companyName.replace(/ /g, '').toLowerCase())
  createCloudStorageBucket('ASIA', 'STANDARD', companyName.replace(/ /g, '').toLowerCase());
};

function localTesting(developerData) {
  var companyName = developerData.companyName.replace(/ /g, '').toLowerCase();
  createCloudStorageBucket('ASIA', 'STANDARD', companyName);
  createDNS(companyName);
  const URL = getLatestWebappReleaseDownloadURL()
  // TODO: This needs to download into memory
  latestBuild = downloadLatestWebappRelease(URL)
  // TODO: Since this will be a cloud function, we need to extract this into
  // memory and not a filesystem
  extractedRelease = extractZip(latestBuild);
  uploadWebapptoCloudStorage(extractedRelease);
  createGiteaUser(developerData);
  createGiteaOrganisation(developerData);
  createGiteaTeam(developerData);
  addDeveloperToOwnerTeam();
  forkWebApp(developerData);
}

function extractZip() {
  //  fs.createReadStream('path/to/archive.zip')
  //    .pipe(unzipper.Extract({ path: 'output/path' }));
}


async function createDNS(companyName) {
  const dns = new DNS();
  const zone = dns.zone('kudoo-applications');

  const newCRecord = zone.record('cname', {
    name: companyName + '.kudoo.org.',
    data: companyName + '.',
    ttl: 86400
  });

  const config = {
    add: newCRecord,
  };

  zone.createChange(config, (err, change, apiResponse) => {
    if (!err) {
      // The change was created successfully.
    }
  });

  //-
  // If the callback is omitted, we'll return a Promise.
  //-
  zone.createChange(config).then((data) => {
    const change = data[0];
    const apiResponse = data[1];
  });

}

async function getLatestWebappReleaseDownloadURL() {
  var options = {
    method: 'GET',
    url: 'https://git.kudoo.io/api/v1/repos/kudoo-cloud/web-app/releases',
    qs: { access_token: process.env.GITEA_ACCESS_TOKEN },
    headers:
    {
      'cache-control': 'no-cache',
      Connection: 'keep-alive',
      Cookie: 'lang=en-US',
      'Accept-Encoding': 'gzip, deflate',
      Host: 'git.kudoo.io',
      'Cache-Control': 'no-cache',
      Accept: '*/*'
    }
  };

  var releaseAsset = await request(options, function (error, response, body) {
    if (error) throw new Error(error);
    var releaseMetadata = JSON.parse(body)
    // TODO: we need to add logic here that iterates through the releases and only 
    // returns the most recent one
    var release = releaseMetadata[0].assets[0].browser_download_url
    // Body returns an array so we need to iterate
    console.log(release)
  });
  return release
}

function downloadLatestWebappRelease(url, dest, cb) {
  // TODO: Since we're deploying on Google Cloud we won't actually be able to
  // download the file to a filesystem, so we'll need to download this into 
  // memory
  var file = fs.createWriteStream(dest);
  var request = http.get(url, function (response) {
    response.pipe(file);
    file.on('finish', function () {
      file.close(cb);  // close() is async, call cb after close completes.
    });
  }).on('error', function (err) { // Handle errors
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
    if (cb) cb(err.message);
  });
}

async function uploadWebapptoCloudStorage() {
  // We will first need to get the latest release files
  recursive("../", function (err, files) {
    // `files` is an array of file paths
    for (let index = 0; index < files.length; index++) {
      //console.log(files[index]);
      /*
      // Uploads a local file to the bucket
      await storage.bucket(bucketName).upload(filename, {
        // Support for HTTP requests made with `Accept-Encoding: gzip`
        gzip: true,
        // By setting the option `destination`, you can change the name of the
        // object you are uploading to a bucket.
        metadata: {
          // Enable long-lived HTTP caching headers
          // Use only if the contents of the file will never change
          // (If the contents will change, use cacheControl: 'no-cache')
          cacheControl: 'public, max-age=31536000',
        },
      });
      */
    }
  });


  console.log(`${filename} uploaded to ${bucketName}.`);
}

function createGiteaUser(developer) {
  var options = {
    method: 'POST',
    url: 'https://git.kudoo.io/api/v1/admin/users',
    qs: { access_token: process.env.GITEA_ACCESS_TOKEN },
    headers:
    {
      'cache-control': 'no-cache',
      'Content-Type': 'application/json'
    },
    body:
    {
      email: developer.email,
      full_name: developer.firstName + ' ' + developer.lastName,
      login_name: developer.userName,
      must_change_password: true,
      password: 'thisIsInsecure12',
      send_notify: true,
      source_id: 0,
      username: developer.userName
    },
    json: true
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });

}

function createGiteaOrganisation(developer) {

  var options = {
    method: 'POST',
    url: 'https://git.kudoo.io/api/v1/admin/users/' + developer.userName + '/orgs',
    qs: { access_token: process.env.GITEA_ACCESS_TOKEN },
    headers:
    {
      'cache-control': 'no-cache',
      'Content-Type': 'application/json'
    },
    body:
    {
      description: developer.companyName,
      full_name: developer.companyName,
      location: developer.location,
      repo_admin_change_team_access: true,
      username: developer.userName,
      visibility: 'public',
      website: developer.website
    },
    json: true
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });

}

function createGiteaTeam(organisation) {
  var options = {
    method: 'POST',
    url: 'https://git.kudoo.io/api/v1/orgs/' + organisation + '/teams',
    qs: { access_token: process.env.GITEA_ACCESS_TOKEN },
    headers:
    {
      'cache-control': 'no-cache',
      'Content-Type': 'application/json'
    },
    body:
    {
      description: 'teamapha',
      name: 'thebois',
      permission: 'write',
      units:
        ['repo.code',
          'repo.issues',
          'repo.ext_issues',
          'repo.wiki',
          'repo.pulls',
          'repo.releases',
          'repo.ext_wiki']
    },
    json: true
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });

}

function addDeveloperToOwnerTeam(user) {
  var options = {
    method: 'PUT',
    url: 'https://git.kudoo.io/api/v1/teams/6/members/' + user,
    qs: { access_token: process.env.GITEA_ACCESS_TOKEN },
    headers:
      { 'cache-control': 'no-cache' }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });

}

function forkWebApp(organisation) {
  var options = {
    method: 'POST',
    url: 'https://git.kudoo.io/api/v1/repos/kudoo-cloud/web-app/forks',
    qs: { access_token: 'f5a63a2a05aa932640417e8bfba47d169ffee660' },
    headers:
    {
      'cache-control': 'no-cache',
      'Content-Type': 'application/json'
    },
    body: { organization: organisation },
    json: true
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });

}

const developer = {
  companyName: "Beta Healthcare",
  website: "https://beta.io",
  location: "Sydney",
  firstName: "Jimi",
  lastName: "Hendrix",
  userName: "jhendrix"
}

localTesting(developer)