const User = require("../models/user.model");
const Ticket = require("../models/ticket.model");
const constants = require("../utils/constants");
const objectConvertor = require("../utils/objectConverter");
const sendEmail = require("../utils/NotificationClient").sendEmail;
require("../middlewares/authjwt");

exports.createTicket = async (req, res) => {
  const ticketObject = {
    title: req.body.title,
    ticketPriority: req.body.ticketPriority,
    description: req.body.description,
    status: req.body.status,
    reporter: req.userId,
  };

  const engineerCount = await User.count({
    userType: constants.userTypes.engineer,
    userStatus: constants.userStatus.approved,
  });
  const random = Math.floor(Math.random() * engineerCount);

  const engineer = await User.findOne({
    userType: constants.userTypes.engineer,
    userStatus: constants.userStatus.approved,
  }).skip(random);

  if (engineer) {
    ticketObject.assignee = engineer.userId;
  }

  console.log(ticketObject);

  try {
    const ticket = await Ticket.create(ticketObject);

    if (ticket) {
      //Updating the customer
      const user = await User.findOne({
        userId: req.userId,
      });
      user.ticketsCreated.push(ticket._id);
      await user.save();

      if (engineer) {
        engineer.ticketsAssigned.push(ticket._id);
        await engineer.save();
      }

      res.status(201).send(objectConvertor.ticketResponse(ticket));
    }
  } catch (err) {
    console.log("Some error happened while creating ticket", err.message);
    res.status(500).send({
      message: "Some internal server error " + err,
    });
  }
};

exports.updateTicket = async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id });

  const savedUser = await User.findOne({
    userId: req.userId,
  });

  if (
    ticket.reporter == req.userId ||
    ticket.assignee == req.userId ||
    savedUser.userType == constants.userTypes.admin
  ) {
    //Allowed to update
    (ticket.title =
      req.body.title != undefined ? req.body.title : ticket.title),
      (ticket.description =
        req.body.description != undefined
          ? req.body.description
          : ticket.description),
      (ticket.ticketPriority =
        req.body.ticketPriority != undefined
          ? req.body.ticketPriority
          : ticket.ticketPriority),
      (ticket.status =
        req.body.status != undefined ? req.body.status : ticket.status),
      (ticket.assignee =
        req.body.assignee != undefined ? req.body.assignee : ticket.assignee);

    var updatedTicket = await ticket.save();

    const engineer = await User.findOne({
      userId: ticket.assignee,
    });

    const reporter = await User.findOne({
      userId: ticket.reporter,
    });

    res.status(200).send(objectConvertor.ticketResponse(updatedTicket));
  } else {
    console.log(
      "Ticket was being updated by someone who has not created the ticket"
    );
    res.status(401).send({
      message: "Ticket can be updated only by the customer who created it",
    });
  }
};

exports.getAllTicketsForAdmin = async (req, res) => {
  const tickets = await Ticket.find();
  res.status(200).send(objectConvertor.ticketListResponse(tickets));
};

exports.getAllTickets = async (req, res) => {
  const queryObj = {};

  if (req.query.status != undefined) {
    queryObj.status = req.query.status;
  }
  const savedUser = await User.findOne({
    userId: req.userId,
  });

  if (savedUser.userType == constants.userTypes.admin) {
    //Do nothing
  } else if (savedUser.userType == constants.userTypes.engineer) {
    queryObj.assignee = req.userId;
  } else {
    queryObj.reporter = req.userId;
  }

  const tickets = await Ticket.find(queryObj);
  res.status(200).send(objectConvertor.ticketListResponse(tickets));
};

/**
 * Get the ticket based on the ticketId
 */

exports.getOneTicket = async (req, res) => {
  const ticket = await Ticket.findOne({
    _id: req.params.id,
  });

  res.status(200).send(objectConvertor.ticketResponse(ticket));
};
