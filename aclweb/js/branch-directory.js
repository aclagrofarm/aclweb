window.aclBranchDirectory = {
  provinces: [
    { id: 'koshi', name: 'Koshi Province', nepali: 'कोशी प्रदेश' },
    { id: 'madhesh', name: 'Madhesh Province', nepali: 'मधेश प्रदेश' },
    { id: 'bagmati', name: 'Bagmati Province', nepali: 'बागमती प्रदेश' },
    { id: 'gandaki', name: 'Gandaki Province', nepali: 'गण्डकी प्रदेश' },
    { id: 'lumbini', name: 'Lumbini Province', nepali: 'लुम्बिनी प्रदेश' },
    { id: 'karnali', name: 'Karnali Province', nepali: 'कर्णाली प्रदेश' },
    { id: 'sudurpashchim', name: 'Sudurpashchim Province', nepali: 'सुदूरपश्चिम प्रदेश' }
  ],
  districtsByProvince: {
    koshi: ['Taplejung', 'Panchthar', 'Ilam', 'Jhapa', 'Morang', 'Sunsari', 'Dhankuta', 'Terhathum', 'Sankhuwasabha', 'Bhojpur', 'Solukhumbu', 'Okhaldhunga', 'Khotang', 'Udayapur'],
    madhesh: ['Saptari', 'Siraha', 'Dhanusha', 'Mahottari', 'Sarlahi', 'Rautahat', 'Bara', 'Parsa'],
    bagmati: ['Dolakha', 'Ramechhap', 'Sindhuli', 'Kavrepalanchok', 'Sindhupalchok', 'Rasuwa', 'Nuwakot', 'Dhading', 'Chitwan', 'Makwanpur', 'Bhaktapur', 'Lalitpur', 'Kathmandu'],
    gandaki: ['Gorkha', 'Manang', 'Mustang', 'Myagdi', 'Kaski', 'Lamjung', 'Tanahun', 'Nawalpur', 'Syangja', 'Parbat', 'Baglung'],
    lumbini: ['Rukum East', 'Rolpa', 'Pyuthan', 'Gulmi', 'Arghakhanchi', 'Palpa', 'Nawalparasi West', 'Rupandehi', 'Kapilvastu', 'Dang', 'Banke', 'Bardiya'],
    karnali: ['Dolpa', 'Mugu', 'Humla', 'Jumla', 'Kalikot', 'Dailekh', 'Jajarkot', 'Rukum West', 'Salyan', 'Surkhet'],
    sudurpashchim: ['Bajura', 'Bajhang', 'Doti', 'Achham', 'Darchula', 'Baitadi', 'Dadeldhura', 'Kanchanpur', 'Kailali']
  },
  headOffice: {
    type: 'head',
    name: 'ACL Agro Farm Ltd. Head Office',
    branchNumber: '',
    operatorName: 'Sren Adhikari',
    address: 'Indreni Complex, New Baneshwor, Kathmandu',
    hours: '9:00 AM–5:00 PM',
    status: 'pending_verification',
    serviceArea: 'Management, administration, agricultural services, investment, and business partnerships.'
  },
  branches: [
    {
      type: 'province', branchCode: 'ACL00001', branchNumber: 'ACL00001',
      name: 'Koshi Farm Support Branch', email: 'branch01@aclagrofarm.com', phone: '+977-9812093798',
      province: 'koshi', district: 'Morang', municipality: 'Biratnagar Metropolitan City', ward: '4',
      address: 'Main Road, Biratnagar-4, Morang', operatorName: 'Ramesh Karki', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Dairy, poultry, greenhouse, and farmer support services in eastern Nepal.',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=Biratnagar+Morang'
    },
    {
      type: 'province', branchCode: 'ACL00002', branchNumber: 'ACL00002',
      name: 'Jhapa Agriculture Branch', email: 'branch02@aclagrofarm.com', phone: '+977-9812093798',
      province: 'koshi', district: 'Jhapa', municipality: 'Birtamod Municipality', ward: '5',
      address: 'Birtamod Bazaar, Birtamod-5, Jhapa', operatorName: 'Anita Rai', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Crop production, farm inputs, and local market coordination.'
    },
    {
      type: 'province', branchCode: 'ACL00003', branchNumber: 'ACL00003',
      name: 'Madhesh Livestock Branch', email: 'branch03@aclagrofarm.com', phone: '+977-9812093798',
      province: 'madhesh', district: 'Dhanusha', municipality: 'Janakpurdham Sub-Metropolitan City', ward: '8',
      address: 'Mills Area, Janakpurdham-8, Dhanusha', operatorName: 'Sanjay Yadav', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Livestock systems, fodder production, and farmer training across Madhesh.'
    },
    {
      type: 'province', branchCode: 'ACL00004', branchNumber: 'ACL00004',
      name: 'Bara Farm Resource Branch', email: 'branch04@aclagrofarm.com', phone: '+977-9812093798',
      province: 'madhesh', district: 'Bara', municipality: 'Kalaiya Sub-Metropolitan City', ward: '7',
      address: 'Bharat Chowk, Kalaiya-7, Bara', operatorName: 'Mina Sah', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Farm resources, irrigation support, and agricultural enterprise development.'
    },
    {
      type: 'province', branchCode: 'ACL00005', branchNumber: 'ACL00005',
      name: 'Kathmandu Valley Branch', email: 'branch05@aclagrofarm.com', phone: '+977-9812093798',
      province: 'bagmati', district: 'Kathmandu', municipality: 'Kageshwori Manohara Municipality', ward: '6',
      address: 'Mulpani, Kageshwori Manohara-6, Kathmandu', operatorName: 'Prakash Shrestha', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Customer relations, project enquiries, investment coordination, and urban farming.'
    },
    {
      type: 'province', branchCode: 'ACL00006', branchNumber: 'ACL00006',
      name: 'Chitwan Production Branch', email: 'branch06@aclagrofarm.com', phone: '+977-9812093798',
      province: 'bagmati', district: 'Chitwan', municipality: 'Bharatpur Metropolitan City', ward: '10',
      address: 'Hakim Chowk, Bharatpur-10, Chitwan', operatorName: 'Bikash Gurung', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Integrated farming, dairy production, and commercial farm project coordination.'
    },
    {
      type: 'province', branchCode: 'ACL00007', branchNumber: 'ACL00007',
      name: 'Kavre Greenhouse Branch', email: 'branch07@aclagrofarm.com', phone: '+977-9812093798',
      province: 'bagmati', district: 'Kavrepalanchok', municipality: 'Dhulikhel Municipality', ward: '7',
      address: 'Dhulikhel Heights, Dhulikhel-7, Kavre', operatorName: 'Sita Tamang', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Greenhouse, hydroponic, and protected cultivation support services.'
    },
    {
      type: 'province', branchCode: 'ACL00008', branchNumber: 'ACL00008',
      name: 'Gandaki Dairy Branch', email: 'branch08@aclagrofarm.com', phone: '+977-9812093798',
      province: 'gandaki', district: 'Kaski', municipality: 'Pokhara Metropolitan City', ward: '17',
      address: 'Birauta, Pokhara-17, Kaski', operatorName: 'Nabin Thapa', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Dairy farming, livestock health, fodder, and cooperative partnerships.'
    },
    {
      type: 'province', branchCode: 'ACL00009', branchNumber: 'ACL00009',
      name: 'Tanahun Farm Development Branch', email: 'branch09@aclagrofarm.com', phone: '+977-9812093798',
      province: 'gandaki', district: 'Tanahun', municipality: 'Byas Municipality', ward: '3',
      address: 'Damauli Bazaar, Byas-3, Tanahun', operatorName: 'Kabita Adhikari', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Smallholder farm development, training, and agricultural market linkage.'
    },
    {
      type: 'province', branchCode: 'ACL00010', branchNumber: 'ACL00010',
      name: 'Lumbini Agro Enterprise Branch', email: 'branch10@aclagrofarm.com', phone: '+977-9812093798',
      province: 'lumbini', district: 'Rupandehi', municipality: 'Butwal Sub-Metropolitan City', ward: '11',
      address: 'Devinagar, Butwal-11, Rupandehi', operatorName: 'Roshan KC', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Commercial farming, farm infrastructure, and enterprise partnership support.'
    },
    {
      type: 'province', branchCode: 'ACL00011', branchNumber: 'ACL00011',
      name: 'Dang Livestock Branch', email: 'branch11@aclagrofarm.com', phone: '+977-9812093798',
      province: 'lumbini', district: 'Dang', municipality: 'Ghorahi Sub-Metropolitan City', ward: '15',
      address: 'Traffic Chowk, Ghorahi-15, Dang', operatorName: 'Laxmi Magar', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Goat, dairy, poultry, and fodder production support in western Nepal.'
    },
    {
      type: 'province', branchCode: 'ACL00012', branchNumber: 'ACL00012',
      name: 'Karnali Agriculture Branch', email: 'branch12@aclagrofarm.com', phone: '+977-9812093798',
      province: 'karnali', district: 'Surkhet', municipality: 'Birendranagar Municipality', ward: '8',
      address: 'Latikoili, Birendranagar-8, Surkhet', operatorName: 'Hari Bista', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Climate-smart agriculture, livestock, and rural farm resource development.'
    },
    {
      type: 'province', branchCode: 'ACL00013', branchNumber: 'ACL00013',
      name: 'Sudurpashchim Farm Branch', email: 'branch13@aclagrofarm.com', phone: '+977-9812093798',
      province: 'sudurpashchim', district: 'Kailali', municipality: 'Dhangadhi Sub-Metropolitan City', ward: '5',
      address: 'Hasanpur, Dhangadhi-5, Kailali', operatorName: 'Deepak Rawal', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Integrated agriculture, livestock support, and farmer market access.'
    },
    {
      type: 'province', branchCode: 'ACL00014', branchNumber: 'ACL00014',
      name: 'Kanchanpur Market Linkage Branch', email: 'branch14@aclagrofarm.com', phone: '+977-9812093798',
      province: 'sudurpashchim', district: 'Kanchanpur', municipality: 'Bhimdatta Municipality', ward: '4',
      address: 'Bhimdatta Bazaar, Bhimdatta-4, Kanchanpur', operatorName: 'Sunita Joshi', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Agricultural collection, cold-chain coordination, and market linkage services.'
    },
    {
      type: 'province', branchCode: 'ACL00015', branchNumber: 'ACL00015',
      name: 'Ilam Sustainable Farming Branch', email: 'branch15@aclagrofarm.com', phone: '+977-9812093798',
      province: 'koshi', district: 'Ilam', municipality: 'Ilam Municipality', ward: '7',
      address: 'Fikkal Road, Ilam-7, Ilam', operatorName: 'Manoj Limbu', operatorTitle: 'Branch Coordinator',
      hours: '9:00 AM–5:00 PM', status: 'active', serviceArea: 'Sustainable cultivation, greenhouse systems, farm tourism, and local enterprise support.'
    }
  ]
};
