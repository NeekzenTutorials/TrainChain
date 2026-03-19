pragma solidity ^0.8.19;

// Contrat de réservation de trains avec remboursement
contract TrainReservationSystem {
    // Données d'un train
    struct Train {
        uint id;
        string name;
        uint totalSeats;
        uint reservedSeats;
        uint price;
        bool exists;
        bool cancelled;
        uint departureTime;
        uint duration;
    }

    // Données d'une réservation
    struct Reservation {
        address user;
        uint trainId;
        uint seatNumber;
        uint amountPaid;
        bool active;
        bool refundRequested;
        bool refunded;
    }

    address public owner;
    uint public nextTrainId;

    mapping(uint => Train) public trains; // ID train → Train
    mapping(uint => Reservation[]) public trainReservations; // ID train → liste des réservations
    mapping(uint => mapping(address => bool)) public hasReserved; // Train × User → reservé?
    mapping(uint => mapping(address => uint)) public userReservationIndex; // Train × User → index dans le tableau
    mapping(address => uint[]) private userTrainIds; // User → liste des trains réservés

    modifier onlyOwner() {
        require(msg.sender == owner, "Seul le proprietaire peut effectuer cette action");
        _;
    }

    // Vérifie que le train existe
    modifier trainExists(uint _trainId) {
        require(trains[_trainId].exists, "Train inexistant");
        _;
    }

    // Initialise le contrat avec le déployeur comme owner
    constructor() {
        owner = msg.sender;
        nextTrainId = 1;
    }

    // Ajoute un nouveau train (admin uniquement)
    function addTrain(
        string memory _name,
        uint _totalSeats,
        uint _priceInEther,
        uint _departureTime,
        uint _duration
    ) public onlyOwner {
        require(_totalSeats > 0, "Le nombre de places doit etre superieur a 0");
        require(_priceInEther > 0, "Le prix doit etre superieur a 0");
        require(_departureTime > block.timestamp, "La date de depart doit etre dans le futur");
        require(_duration > 0, "La duree doit etre superieure a 0");

        trains[nextTrainId] = Train({
            id: nextTrainId,
            name: _name,
            totalSeats: _totalSeats,
            reservedSeats: 0,
            price: _priceInEther * 1 ether,
            exists: true,
            cancelled: false,
            departureTime: _departureTime,
            duration: _duration
        });

        nextTrainId++;
    }

    // Réserve une place dans un train (montant exact requis)
    function reserve(uint _trainId) public payable trainExists(_trainId) {
        Train storage train = trains[_trainId];

        require(!train.cancelled, "Ce train a ete annule");
        require(!hasReserved[_trainId][msg.sender], "Vous avez deja reserve dans ce train");
        require(train.reservedSeats < train.totalSeats, "Plus de places disponibles dans ce train");
        require(msg.value == train.price, "Montant incorrect");

        uint seatNumber = train.reservedSeats + 1;

        trainReservations[_trainId].push(
            Reservation({
                user: msg.sender,
                trainId: _trainId,
                seatNumber: seatNumber,
                amountPaid: msg.value,
                active: true,
                refundRequested: false,
                refunded: false
            })
        );

        hasReserved[_trainId][msg.sender] = true;
        userReservationIndex[_trainId][msg.sender] = trainReservations[_trainId].length - 1;
        userTrainIds[msg.sender].push(_trainId);
        train.reservedSeats++;
    }

    // Annule une réservation
    function cancelReservation(uint _trainId) public trainExists(_trainId) {
        require(hasReserved[_trainId][msg.sender], "Vous n'avez pas de reservation dans ce train");

        uint index = userReservationIndex[_trainId][msg.sender];
        Reservation storage reservation = trainReservations[_trainId][index];

        require(reservation.active, "Reservation deja annulee");

        reservation.active = false;
        hasReserved[_trainId][msg.sender] = false;
        trains[_trainId].reservedSeats--;
    }

    // Demande un remboursement après annulation
    function requestRefund(uint _trainId) public trainExists(_trainId) {
        uint index = userReservationIndex[_trainId][msg.sender];
        Reservation storage reservation = trainReservations[_trainId][index];

        require(reservation.user == msg.sender, "Reservation inexistante");
        require(!reservation.active, "Annulez d'abord la reservation");
        require(!reservation.refundRequested, "Remboursement deja demande");
        require(!reservation.refunded, "Deja rembourse");

        reservation.refundRequested = true;
    }

    // Approuve et effectue le remboursement (admin uniquement)
    function approveRefund(uint _trainId, address _user)
        public
        onlyOwner
        trainExists(_trainId)
    {
        uint index = userReservationIndex[_trainId][_user];
        Reservation storage reservation = trainReservations[_trainId][index];

        require(reservation.user == _user, "Reservation inexistante");
        require(reservation.refundRequested, "Aucune demande de remboursement");
        require(!reservation.refunded, "Deja rembourse");

        uint amount = reservation.amountPaid;
        reservation.refunded = true;
        reservation.refundRequested = false;

        payable(_user).transfer(amount);
    }

    // Refuse une demande de remboursement (admin uniquement)
    function rejectRefund(uint _trainId, address _user)
        public
        onlyOwner
        trainExists(_trainId)
    {
        uint index = userReservationIndex[_trainId][_user];
        Reservation storage reservation = trainReservations[_trainId][index];

        require(reservation.user == _user, "Reservation inexistante");
        require(reservation.refundRequested, "Aucune demande de remboursement");
        require(!reservation.refunded, "Deja rembourse");

        reservation.refundRequested = false;
    }

    // Annule un train et rembourse automatiquement tous les passagers
    function cancelTrain(uint _trainId)
        public
        onlyOwner
        trainExists(_trainId)
    {
        Train storage train = trains[_trainId];
        require(!train.cancelled, "Train deja annule");

        train.cancelled = true;

        // Rembourser tous les passagers qui ont payé et ne sont pas encore remboursés
        uint resCount = trainReservations[_trainId].length;
        for (uint i = 0; i < resCount; i++) {
            Reservation storage reservation = trainReservations[_trainId][i];
            if (!reservation.refunded && reservation.amountPaid > 0) {
                reservation.refunded = true;
                reservation.refundRequested = false;
                reservation.active = false;
                payable(reservation.user).transfer(reservation.amountPaid);
            }
        }

        train.reservedSeats = 0;
    }

    // Retourne les infos d'un train
    function getTrain(uint _trainId)
        public
        view
        trainExists(_trainId)
        returns (
            uint id,
            string memory name,
            uint totalSeats,
            uint reservedSeats,
            uint availableSeats,
            uint priceInWei,
            bool cancelled,
            uint departureTime,
            uint duration
        )
    {
        Train memory train = trains[_trainId];
        return (
            train.id,
            train.name,
            train.totalSeats,
            train.reservedSeats,
            train.totalSeats - train.reservedSeats,
            train.price,
            train.cancelled,
            train.departureTime,
            train.duration
        );
    }

    // Retourne le nombre total de trains
    function getTrainCount() public view returns (uint) {
        return nextTrainId - 1;
    }

    // Récupère la réservation d'un utilisateur pour un train
    function getReservation(uint _trainId, address _user)
        public
        view
        trainExists(_trainId)
        returns (
            address user,
            uint trainId,
            uint seatNumber,
            uint amountPaid,
            bool active,
            bool refundRequested,
            bool refunded
        )
    {
        require(
            trainReservations[_trainId].length > 0,
            "Aucune reservation pour ce train"
        );

        uint index = userReservationIndex[_trainId][_user];
        Reservation memory reservation = trainReservations[_trainId][index];

        require(reservation.user == _user, "Reservation inexistante");

        return (
            reservation.user,
            reservation.trainId,
            reservation.seatNumber,
            reservation.amountPaid,
            reservation.active,
            reservation.refundRequested,
            reservation.refunded
        );
    }

    // Récupère une réservation par son index dans les réservations d'un train
    function getReservationByIndex(uint _trainId, uint _index)
        public
        view
        trainExists(_trainId)
        returns (
            address user,
            uint trainId,
            uint seatNumber,
            uint amountPaid,
            bool active,
            bool refundRequested,
            bool refunded
        )
    {
        require(_index < trainReservations[_trainId].length, "Index invalide");

        Reservation memory reservation = trainReservations[_trainId][_index];
        return (
            reservation.user,
            reservation.trainId,
            reservation.seatNumber,
            reservation.amountPaid,
            reservation.active,
            reservation.refundRequested,
            reservation.refunded
        );
    }

    // Retourne le nombre de réservations pour un train
    function getReservationsCount(uint _trainId)
        public
        view
        trainExists(_trainId)
        returns (uint)
    {
        return trainReservations[_trainId].length;
    }

    // Vérifie si un utilisateur a réservé dans un train
    function hasUserReserved(uint _trainId, address _user)
        public
        view
        trainExists(_trainId)
        returns (bool)
    {
        return hasReserved[_trainId][_user];
    }

    // Retourne le solde du contrat (admin uniquement)
    function getContractBalance() public view onlyOwner returns (uint) {
        return address(this).balance;
    }

    // Retourne les IDs des trains réservés par un utilisateur
    function getUserReservedTrains(address _user) public view returns (uint[] memory) {
        return userTrainIds[_user];
    }
}