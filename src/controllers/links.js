import isLinkPaid from 'helpers/isLinkPaid';
import addWebhooksForLink from 'helpers/addWebhooksForLink';

// A utility function to check if a user is authenticated, and if so, return
// the authenticated user. Otherwise, this function will throw an error
function assertLoggedIn(req, res) {
  if (req.isAuthenticated()) {
    return req.user;
  } else {
    res.status(403).send({error: 'Not authenticated.'});
  }
}

// Return all links in a condensed format. Included is {_id, name, paid, enabled}.
// This will support pagination.
export function index(Link, req, res) {
  let user = assertLoggedIn(req, res);

  return Link.find({owner: user}).exec((err, links) => {
    if (err) {
      console.trace(err);
      return res.status(500).send({error: 'Database error.'});
    }

    let lastId = links.length > 0 ? links.slice(-1)[0]._id : null
    res.status(200).send({
      data: links.map(link => {
        return {_id: link._id, name: link.name, enabled: link.enabled, paid: link.paid};
      }),
      lastId,
    });
  });
}

// Return one single link in full, expanded format.
// This will support pagination.
export function get(Link, req, res) {
  let user = assertLoggedIn(req, res);

  return Link.findOne({_id: req.params.id, owner: user}).exec((err, link) => {
    if (err) {
      console.trace(err);
      return res.status(500).send({error: 'Database error.'});
    }

    res.status(200).send(link);
  });
}

// Create a new Link. This new link is disabled and is really just a
// placeholder for an update later on.
// This will support pagination.
export function create(Link, req, res) {
  let user = assertLoggedIn(req, res);

  if (req.isAuthenticated()) {
    let link = new Link({enabled: false, owner: req.user, to: null, false: null});
    link.save(err => {
      if (err) {
        console.trace(err);
        return res.status(500).send({error: 'Database error.'});
      }

      res.status(201).send(link.format());
    });
  } else {
    res.status(403).send({error: 'Not authenticated'});
  }
}



// Update a Link. This method requires a body with a link property.
// Responds with {"status": "ok"} on success.
export function update(Link, req, res) {
  let user = assertLoggedIn(req, res);

  // Ensure the user is authenticated, and they passed a seeminly correct body.
  if (!req.isAuthenticated()) {
    return res.status(403).send({error: 'Not authenticated'});
  } else if (!req.body.link) {
    return res.status(400).send({error: 'No link field in json body.'});
  }

  let link = req.body.link;

  // Vaidate the body against a schema
  let formatErrors = Link.isValidLink(req.body.link).errors;
  if (formatErrors.length > 0) {
    return res.status(400).send(formatErrors);
  }

  // remove a link's id when updating, if it exists
  link._id = req.params.linkId;

  // Change a couple fields
  isLinkPaid(req.user, link)
  .then(paid => {
    link.paid = paid;
    return addWebhooksForLink(req.user, link)
  }).then(hooks => {
    Link.update({_id: req.params.linkId, owner: user}, link).exec((err, data) => {
      if (err) {
        console.trace(err);
        return res.status(500).send({error: 'Database error.'});
      }

      res.status(200).send({status: 'ok'});
    });
  }).catch(err => {
    console.trace(err);
    res.status(500).send({error: "Server error"});
  });
}

// Enable or disable a link. Requires a body like {"enabled": true/false}, and
// responds with {"status": "ok"}
export function enable(Link, req, res) {
  let user = assertLoggedIn(req, res);

  if (!req.isAuthenticated()) {
    res.status(403).send({error: 'Not authenticated'});
  } else if (typeof req.body.enabled !== 'boolean') {
    res.status(500).send({error: 'Enabled property not specified in the body.'});
  } else {
    Link.update({
      _id: req.params.linkId,
      owner: user,
    }, {
      enabled: req.body.enabled,
    }).exec((err, data) => {
      if (err) {
        console.trace(err);
        return res.status(500).send({error: 'Database error.'});
      }

      res.status(200).send({status: 'ok'});
    });
  }
}
