/**
 * Schema.org Registry
 * Comprehensive mapping of 130+ schema types for every business use case
 *
 * Based on Schema.org specifications with enhanced keyword matching
 */

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type PropertyType = 'text' | 'number' | 'url' | 'date' | 'email' | 'phone' | 'address' | 'currency' | 'rating' | 'image' | 'boolean';

export interface SchemaProperty {
  name: string;
  type: PropertyType;
  required?: boolean;
  description?: string;
  example?: string;
}

export interface SchemaTypeDefinition {
  type: string;
  parent?: string; // Inheritance
  description: string;
  properties: SchemaProperty[];
  recommendedFor?: string[]; // Keywords for auto-detection
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMON PROPERTY SETS (Reusable)
// ═══════════════════════════════════════════════════════════════════════════

const LOCAL_BUSINESS_PROPERTIES: SchemaProperty[] = [
  { name: 'name', type: 'text', required: true, description: 'Business name' },
  { name: 'description', type: 'text', description: 'Business description' },
  { name: 'image', type: 'image', description: 'Business photo' },
  { name: 'telephone', type: 'phone', description: 'Phone number' },
  { name: 'email', type: 'email', description: 'Email address' },
  { name: 'address', type: 'address', description: 'Business address' },
  { name: 'priceRange', type: 'text', description: 'Price range (e.g., $$)' },
  { name: 'openingHours', type: 'text', description: 'Business hours' },
  { name: 'aggregateRating', type: 'rating', description: 'Average rating' },
  { name: 'geo', type: 'text', description: 'Geographic coordinates' },
];

const STORE_PROPERTIES: SchemaProperty[] = [
  ...LOCAL_BUSINESS_PROPERTIES,
  { name: 'paymentAccepted', type: 'text', description: 'Accepted payment methods' },
  { name: 'currenciesAccepted', type: 'text', description: 'Accepted currencies' },
];

const FOOD_ESTABLISHMENT_PROPERTIES: SchemaProperty[] = [
  ...LOCAL_BUSINESS_PROPERTIES,
  { name: 'servesCuisine', type: 'text', description: 'Cuisine type' },
  { name: 'menu', type: 'url', description: 'Menu URL' },
  { name: 'acceptsReservations', type: 'boolean', description: 'Accepts reservations' },
];

const MEDICAL_PROPERTIES: SchemaProperty[] = [
  ...LOCAL_BUSINESS_PROPERTIES,
  { name: 'medicalSpecialty', type: 'text', description: 'Medical specialty' },
  { name: 'availableService', type: 'text', description: 'Services offered' },
  { name: 'isAcceptingNewPatients', type: 'boolean', description: 'Accepting new patients' },
];

const LODGING_PROPERTIES: SchemaProperty[] = [
  ...LOCAL_BUSINESS_PROPERTIES,
  { name: 'amenityFeature', type: 'text', description: 'Available amenities' },
  { name: 'checkinTime', type: 'text', description: 'Check-in time' },
  { name: 'checkoutTime', type: 'text', description: 'Check-out time' },
  { name: 'numberOfRooms', type: 'number', description: 'Number of rooms' },
  { name: 'petsAllowed', type: 'boolean', description: 'Pets allowed' },
];

const EVENT_PROPERTIES: SchemaProperty[] = [
  { name: 'name', type: 'text', required: true, description: 'Event name' },
  { name: 'description', type: 'text', description: 'Event description' },
  { name: 'startDate', type: 'date', required: true, description: 'Start date/time' },
  { name: 'endDate', type: 'date', description: 'End date/time' },
  { name: 'location', type: 'address', description: 'Event location' },
  { name: 'organizer', type: 'text', description: 'Organizer' },
  { name: 'image', type: 'image', description: 'Event image' },
  { name: 'offers', type: 'text', description: 'Ticket info' },
  { name: 'eventStatus', type: 'text', description: 'Event status' },
  { name: 'eventAttendanceMode', type: 'text', description: 'Online/offline/mixed' },
];

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA REGISTRY - 130+ Types
// ═══════════════════════════════════════════════════════════════════════════

export const SCHEMA_REGISTRY: Record<string, SchemaTypeDefinition> = {
  // ─────────────────────────────────────────────────────────────────────────
  // THING (Base type)
  // ─────────────────────────────────────────────────────────────────────────
  Thing: {
    type: 'Thing',
    description: 'The most generic type of item',
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Name of the item' },
      { name: 'description', type: 'text', description: 'Description of the item' },
      { name: 'image', type: 'image', description: 'Image of the item' },
      { name: 'url', type: 'url', description: 'URL of the item' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CREATIVE WORKS
  // ─────────────────────────────────────────────────────────────────────────
  CreativeWork: {
    type: 'CreativeWork',
    parent: 'Thing',
    description: 'A creative work',
    recommendedFor: ['content', 'media', 'publication'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Work title' },
      { name: 'description', type: 'text', description: 'Description' },
      { name: 'author', type: 'text', description: 'Author' },
      { name: 'datePublished', type: 'date', description: 'Publication date' },
      { name: 'dateModified', type: 'date', description: 'Last modified date' },
    ]
  },

  WebPage: {
    type: 'WebPage',
    parent: 'CreativeWork',
    description: 'A web page',
    recommendedFor: ['any'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Page title' },
      { name: 'description', type: 'text', required: true, description: 'Page description' },
      { name: 'url', type: 'url', description: 'Canonical URL' },
      { name: 'image', type: 'image', description: 'Featured image' },
      { name: 'datePublished', type: 'date', description: 'Publication date' },
      { name: 'dateModified', type: 'date', description: 'Last modified date' },
      { name: 'author', type: 'text', description: 'Page author' },
      { name: 'keywords', type: 'text', description: 'Keywords' },
    ]
  },

  Article: {
    type: 'Article',
    parent: 'CreativeWork',
    description: 'An article, blog post, or news story',
    recommendedFor: ['blog', 'news', 'magazine', 'article', 'post'],
    properties: [
      { name: 'headline', type: 'text', required: true, description: 'Article headline' },
      { name: 'description', type: 'text', description: 'Brief description' },
      { name: 'articleBody', type: 'text', description: 'Full article content' },
      { name: 'author', type: 'text', required: true, description: 'Author name' },
      { name: 'datePublished', type: 'date', required: true, description: 'Publication date' },
      { name: 'dateModified', type: 'date', description: 'Last modified date' },
      { name: 'image', type: 'image', description: 'Article image' },
      { name: 'articleSection', type: 'text', description: 'Section/category' },
    ]
  },

  BlogPosting: {
    type: 'BlogPosting',
    parent: 'Article',
    description: 'A blog post',
    recommendedFor: ['blog', 'blog post', 'blogger', 'blogging'],
    properties: [
      { name: 'headline', type: 'text', required: true, description: 'Post headline' },
      { name: 'description', type: 'text', description: 'Brief description' },
      { name: 'articleBody', type: 'text', description: 'Full post content' },
      { name: 'author', type: 'text', required: true, description: 'Author name' },
      { name: 'datePublished', type: 'date', required: true, description: 'Publication date' },
      { name: 'image', type: 'image', description: 'Featured image' },
    ]
  },

  NewsArticle: {
    type: 'NewsArticle',
    parent: 'Article',
    description: 'A news article',
    recommendedFor: ['news', 'newspaper', 'journalism', 'press', 'media'],
    properties: [
      { name: 'headline', type: 'text', required: true, description: 'News headline' },
      { name: 'dateline', type: 'text', description: 'News dateline' },
      { name: 'articleBody', type: 'text', description: 'Article content' },
      { name: 'author', type: 'text', required: true, description: 'Reporter/Author' },
      { name: 'datePublished', type: 'date', required: true, description: 'Publication date' },
    ]
  },

  FAQPage: {
    type: 'FAQPage',
    parent: 'WebPage',
    description: 'A page containing FAQ content',
    recommendedFor: ['faq', 'questions', 'help', 'support'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'FAQ page title' },
      { name: 'description', type: 'text', description: 'FAQ page description' },
      { name: 'mainEntity', type: 'text', description: 'Questions and answers (nested)' },
    ]
  },

  HowTo: {
    type: 'HowTo',
    parent: 'CreativeWork',
    description: 'Instructions for a task',
    recommendedFor: ['how to', 'tutorial', 'guide', 'instructions', 'diy'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'How-to title' },
      { name: 'description', type: 'text', description: 'Overview' },
      { name: 'totalTime', type: 'text', description: 'Duration (e.g., PT30M)' },
      { name: 'step', type: 'text', description: 'Steps (nested HowToStep)' },
      { name: 'supply', type: 'text', description: 'Supplies needed' },
      { name: 'tool', type: 'text', description: 'Tools needed' },
    ]
  },

  Recipe: {
    type: 'Recipe',
    parent: 'HowTo',
    description: 'A recipe for cooking',
    recommendedFor: ['recipe', 'cooking', 'food blog', 'cookbook'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Recipe name' },
      { name: 'description', type: 'text', description: 'Recipe description' },
      { name: 'recipeIngredient', type: 'text', description: 'Ingredients list' },
      { name: 'recipeInstructions', type: 'text', description: 'Cooking instructions' },
      { name: 'prepTime', type: 'text', description: 'Prep time (ISO 8601)' },
      { name: 'cookTime', type: 'text', description: 'Cook time (ISO 8601)' },
      { name: 'totalTime', type: 'text', description: 'Total time (ISO 8601)' },
      { name: 'recipeYield', type: 'text', description: 'Servings' },
      { name: 'recipeCuisine', type: 'text', description: 'Cuisine type' },
      { name: 'recipeCategory', type: 'text', description: 'Category (dinner, dessert, etc.)' },
      { name: 'nutrition', type: 'text', description: 'Nutrition information' },
      { name: 'image', type: 'image', description: 'Recipe photo' },
    ]
  },

  Course: {
    type: 'Course',
    parent: 'CreativeWork',
    description: 'An educational course',
    recommendedFor: ['course', 'class', 'training', 'education', 'online course', 'e-learning'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Course name' },
      { name: 'description', type: 'text', description: 'Course description' },
      { name: 'provider', type: 'text', description: 'Course provider' },
      { name: 'courseCode', type: 'text', description: 'Course code/ID' },
      { name: 'coursePrerequisites', type: 'text', description: 'Prerequisites' },
      { name: 'educationalLevel', type: 'text', description: 'Level (beginner, advanced)' },
      { name: 'hasCourseInstance', type: 'text', description: 'Course instances' },
    ]
  },

  Book: {
    type: 'Book',
    parent: 'CreativeWork',
    description: 'A book',
    recommendedFor: ['book', 'ebook', 'author', 'publisher', 'bookstore'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Book title' },
      { name: 'author', type: 'text', required: true, description: 'Author name' },
      { name: 'isbn', type: 'text', description: 'ISBN' },
      { name: 'numberOfPages', type: 'number', description: 'Page count' },
      { name: 'bookFormat', type: 'text', description: 'Format (Hardcover, Paperback, EBook)' },
      { name: 'publisher', type: 'text', description: 'Publisher' },
      { name: 'datePublished', type: 'date', description: 'Publication date' },
    ]
  },

  Movie: {
    type: 'Movie',
    parent: 'CreativeWork',
    description: 'A movie',
    recommendedFor: ['movie', 'film', 'cinema', 'video production'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Movie title' },
      { name: 'director', type: 'text', description: 'Director' },
      { name: 'actor', type: 'text', description: 'Cast members' },
      { name: 'duration', type: 'text', description: 'Runtime (ISO 8601)' },
      { name: 'datePublished', type: 'date', description: 'Release date' },
      { name: 'productionCompany', type: 'text', description: 'Production company' },
    ]
  },

  MusicRecording: {
    type: 'MusicRecording',
    parent: 'CreativeWork',
    description: 'A music recording',
    recommendedFor: ['music', 'song', 'album', 'recording studio', 'musician'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Track name' },
      { name: 'byArtist', type: 'text', description: 'Artist name' },
      { name: 'duration', type: 'text', description: 'Duration (ISO 8601)' },
      { name: 'inAlbum', type: 'text', description: 'Album name' },
      { name: 'recordingOf', type: 'text', description: 'Musical work' },
    ]
  },

  SoftwareSourceCode: {
    type: 'SoftwareSourceCode',
    parent: 'CreativeWork',
    description: 'Software source code',
    recommendedFor: ['open source', 'github', 'code', 'programming', 'developer tools'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Project name' },
      { name: 'codeRepository', type: 'url', description: 'Repository URL' },
      { name: 'programmingLanguage', type: 'text', description: 'Programming language' },
      { name: 'runtimePlatform', type: 'text', description: 'Runtime platform' },
      { name: 'targetProduct', type: 'text', description: 'Target application' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ORGANIZATIONS & BUSINESSES (Base types)
  // ─────────────────────────────────────────────────────────────────────────
  Organization: {
    type: 'Organization',
    parent: 'Thing',
    description: 'An organization such as a company or nonprofit',
    recommendedFor: ['company', 'organization', 'nonprofit', 'corporation'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Organization name' },
      { name: 'description', type: 'text', description: 'About the organization' },
      { name: 'url', type: 'url', description: 'Website URL' },
      { name: 'logo', type: 'image', description: 'Logo URL' },
      { name: 'email', type: 'email', description: 'Contact email' },
      { name: 'telephone', type: 'phone', description: 'Phone number' },
      { name: 'address', type: 'address', description: 'Physical address' },
      { name: 'sameAs', type: 'url', description: 'Social media profiles' },
    ]
  },

  LocalBusiness: {
    type: 'LocalBusiness',
    parent: 'Organization',
    description: 'A local business with a physical location',
    recommendedFor: ['local business', 'small business', 'shop', 'service'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STORE TYPES (30 types)
  // ─────────────────────────────────────────────────────────────────────────
  Store: {
    type: 'Store',
    parent: 'LocalBusiness',
    description: 'A retail store',
    recommendedFor: ['store', 'retail', 'shop', 'shopping'],
    properties: STORE_PROPERTIES
  },

  AutoPartsStore: {
    type: 'AutoPartsStore',
    parent: 'Store',
    description: 'An auto parts store',
    recommendedFor: ['auto parts', 'car parts', 'automotive parts', 'vehicle parts'],
    properties: STORE_PROPERTIES
  },

  BikeStore: {
    type: 'BikeStore',
    parent: 'Store',
    description: 'A bicycle store',
    recommendedFor: ['bike shop', 'bicycle store', 'bike store', 'cycling shop', 'bicycle shop'],
    properties: STORE_PROPERTIES
  },

  BookStore: {
    type: 'BookStore',
    parent: 'Store',
    description: 'A bookstore',
    recommendedFor: ['bookstore', 'book shop', 'books', 'bookshop'],
    properties: STORE_PROPERTIES
  },

  ClothingStore: {
    type: 'ClothingStore',
    parent: 'Store',
    description: 'A clothing store',
    recommendedFor: ['clothing store', 'apparel', 'fashion', 'clothes shop', 'boutique'],
    properties: STORE_PROPERTIES
  },

  ComputerStore: {
    type: 'ComputerStore',
    parent: 'Store',
    description: 'A computer store',
    recommendedFor: ['computer store', 'pc shop', 'computer shop', 'tech store'],
    properties: STORE_PROPERTIES
  },

  ConvenienceStore: {
    type: 'ConvenienceStore',
    parent: 'Store',
    description: 'A convenience store',
    recommendedFor: ['convenience store', 'corner store', 'mini mart', 'bodega'],
    properties: STORE_PROPERTIES
  },

  DepartmentStore: {
    type: 'DepartmentStore',
    parent: 'Store',
    description: 'A department store',
    recommendedFor: ['department store', 'large store', 'retail chain'],
    properties: STORE_PROPERTIES
  },

  ElectronicsStore: {
    type: 'ElectronicsStore',
    parent: 'Store',
    description: 'An electronics store',
    recommendedFor: ['electronics store', 'electronics shop', 'gadget store', 'tech shop'],
    properties: STORE_PROPERTIES
  },

  Florist: {
    type: 'Florist',
    parent: 'Store',
    description: 'A florist shop',
    recommendedFor: ['florist', 'flower shop', 'flowers', 'floral shop', 'flower store'],
    properties: STORE_PROPERTIES
  },

  FurnitureStore: {
    type: 'FurnitureStore',
    parent: 'Store',
    description: 'A furniture store',
    recommendedFor: ['furniture store', 'furniture shop', 'home furnishings'],
    properties: STORE_PROPERTIES
  },

  GardenStore: {
    type: 'GardenStore',
    parent: 'Store',
    description: 'A garden store or nursery',
    recommendedFor: ['garden store', 'garden center', 'nursery', 'plant shop', 'gardening'],
    properties: STORE_PROPERTIES
  },

  GroceryStore: {
    type: 'GroceryStore',
    parent: 'Store',
    description: 'A grocery store',
    recommendedFor: ['grocery store', 'supermarket', 'grocery', 'food store', 'market'],
    properties: STORE_PROPERTIES
  },

  HardwareStore: {
    type: 'HardwareStore',
    parent: 'Store',
    description: 'A hardware store',
    recommendedFor: ['hardware store', 'home improvement', 'tools', 'diy store'],
    properties: STORE_PROPERTIES
  },

  HobbyShop: {
    type: 'HobbyShop',
    parent: 'Store',
    description: 'A hobby shop',
    recommendedFor: ['hobby shop', 'hobby store', 'craft store', 'model shop'],
    properties: STORE_PROPERTIES
  },

  HomeGoodsStore: {
    type: 'HomeGoodsStore',
    parent: 'Store',
    description: 'A home goods store',
    recommendedFor: ['home goods', 'housewares', 'home store', 'home decor'],
    properties: STORE_PROPERTIES
  },

  JewelryStore: {
    type: 'JewelryStore',
    parent: 'Store',
    description: 'A jewelry store',
    recommendedFor: ['jewelry store', 'jeweler', 'jewelry shop', 'jewellery'],
    properties: STORE_PROPERTIES
  },

  LiquorStore: {
    type: 'LiquorStore',
    parent: 'Store',
    description: 'A liquor store',
    recommendedFor: ['liquor store', 'wine shop', 'spirits', 'bottle shop', 'wine store'],
    properties: STORE_PROPERTIES
  },

  MensClothingStore: {
    type: 'MensClothingStore',
    parent: 'Store',
    description: 'A men\'s clothing store',
    recommendedFor: ['mens clothing', 'menswear', 'mens fashion', 'mens apparel'],
    properties: STORE_PROPERTIES
  },

  MobilePhoneStore: {
    type: 'MobilePhoneStore',
    parent: 'Store',
    description: 'A mobile phone store',
    recommendedFor: ['phone store', 'mobile store', 'cell phone', 'smartphone'],
    properties: STORE_PROPERTIES
  },

  MovieRentalStore: {
    type: 'MovieRentalStore',
    parent: 'Store',
    description: 'A movie rental store',
    recommendedFor: ['movie rental', 'video rental', 'dvd rental'],
    properties: STORE_PROPERTIES
  },

  MusicStore: {
    type: 'MusicStore',
    parent: 'Store',
    description: 'A music store',
    recommendedFor: ['music store', 'record store', 'instrument store', 'vinyl', 'music shop'],
    properties: STORE_PROPERTIES
  },

  OfficeEquipmentStore: {
    type: 'OfficeEquipmentStore',
    parent: 'Store',
    description: 'An office equipment store',
    recommendedFor: ['office supplies', 'office equipment', 'stationery'],
    properties: STORE_PROPERTIES
  },

  OutletStore: {
    type: 'OutletStore',
    parent: 'Store',
    description: 'An outlet store',
    recommendedFor: ['outlet', 'outlet store', 'factory outlet', 'discount store'],
    properties: STORE_PROPERTIES
  },

  PawnShop: {
    type: 'PawnShop',
    parent: 'Store',
    description: 'A pawn shop',
    recommendedFor: ['pawn shop', 'pawnbroker', 'pawn store'],
    properties: STORE_PROPERTIES
  },

  PetStore: {
    type: 'PetStore',
    parent: 'Store',
    description: 'A pet store',
    recommendedFor: ['pet store', 'pet shop', 'pet supplies', 'pet supply'],
    properties: STORE_PROPERTIES
  },

  ShoeStore: {
    type: 'ShoeStore',
    parent: 'Store',
    description: 'A shoe store',
    recommendedFor: ['shoe store', 'footwear', 'shoe shop', 'shoes'],
    properties: STORE_PROPERTIES
  },

  SportingGoodsStore: {
    type: 'SportingGoodsStore',
    parent: 'Store',
    description: 'A sporting goods store',
    recommendedFor: ['sporting goods', 'sports store', 'athletic store', 'sports equipment'],
    properties: STORE_PROPERTIES
  },

  TireShop: {
    type: 'TireShop',
    parent: 'Store',
    description: 'A tire shop',
    recommendedFor: ['tire shop', 'tire store', 'tires', 'wheel shop'],
    properties: STORE_PROPERTIES
  },

  ToyStore: {
    type: 'ToyStore',
    parent: 'Store',
    description: 'A toy store',
    recommendedFor: ['toy store', 'toy shop', 'toys', 'game store'],
    properties: STORE_PROPERTIES
  },

  WholesaleStore: {
    type: 'WholesaleStore',
    parent: 'Store',
    description: 'A wholesale store',
    recommendedFor: ['wholesale', 'bulk store', 'warehouse store', 'wholesale club'],
    properties: STORE_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FOOD ESTABLISHMENT TYPES (9 types)
  // ─────────────────────────────────────────────────────────────────────────
  FoodEstablishment: {
    type: 'FoodEstablishment',
    parent: 'LocalBusiness',
    description: 'A food establishment',
    recommendedFor: ['food', 'dining', 'eatery'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  Bakery: {
    type: 'Bakery',
    parent: 'FoodEstablishment',
    description: 'A bakery',
    recommendedFor: ['bakery', 'baker', 'pastry shop', 'bread shop', 'baked goods'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  BarOrPub: {
    type: 'BarOrPub',
    parent: 'FoodEstablishment',
    description: 'A bar or pub',
    recommendedFor: ['bar', 'pub', 'tavern', 'lounge', 'cocktail bar', 'sports bar'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  Brewery: {
    type: 'Brewery',
    parent: 'FoodEstablishment',
    description: 'A brewery',
    recommendedFor: ['brewery', 'craft brewery', 'brewpub', 'beer', 'microbrewery'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  CafeOrCoffeeShop: {
    type: 'CafeOrCoffeeShop',
    parent: 'FoodEstablishment',
    description: 'A cafe or coffee shop',
    recommendedFor: ['cafe', 'coffee shop', 'coffee house', 'coffeeshop', 'espresso bar', 'coffee'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  Distillery: {
    type: 'Distillery',
    parent: 'FoodEstablishment',
    description: 'A distillery',
    recommendedFor: ['distillery', 'spirits', 'whiskey', 'vodka', 'gin'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  FastFoodRestaurant: {
    type: 'FastFoodRestaurant',
    parent: 'FoodEstablishment',
    description: 'A fast food restaurant',
    recommendedFor: ['fast food', 'quick service', 'drive through', 'drive thru'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  IceCreamShop: {
    type: 'IceCreamShop',
    parent: 'FoodEstablishment',
    description: 'An ice cream shop',
    recommendedFor: ['ice cream', 'ice cream shop', 'gelato', 'frozen yogurt', 'froyo'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  Restaurant: {
    type: 'Restaurant',
    parent: 'FoodEstablishment',
    description: 'A restaurant',
    recommendedFor: ['restaurant', 'dining', 'bistro', 'eatery', 'grill', 'diner'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  Menu: {
    type: 'Menu',
    parent: 'CreativeWork',
    description: 'A menu for a restaurant or food establishment',
    recommendedFor: ['menu', 'food menu', 'restaurant menu'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Menu name' },
      { name: 'description', type: 'text', description: 'Menu description' },
      { name: 'hasMenuSection', type: 'text', description: 'Menu sections' },
      { name: 'hasMenuItem', type: 'text', description: 'Menu items' },
    ]
  },

  MenuItem: {
    type: 'MenuItem',
    parent: 'Thing',
    description: 'A menu item at a restaurant',
    recommendedFor: ['menu item', 'dish', 'food item'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Item name' },
      { name: 'description', type: 'text', description: 'Item description' },
      { name: 'offers', type: 'text', description: 'Price/offer info' },
      { name: 'nutrition', type: 'text', description: 'Nutrition information' },
      { name: 'suitableForDiet', type: 'text', description: 'Dietary suitability' },
    ]
  },

  Reservation: {
    type: 'Reservation',
    parent: 'Thing',
    description: 'A reservation',
    recommendedFor: ['reservation', 'booking'],
    properties: [
      { name: 'reservationId', type: 'text', description: 'Reservation ID' },
      { name: 'reservationStatus', type: 'text', description: 'Status' },
      { name: 'underName', type: 'text', description: 'Name reservation is under' },
    ]
  },

  FoodEstablishmentReservation: {
    type: 'FoodEstablishmentReservation',
    parent: 'Reservation',
    description: 'A reservation at a food establishment',
    recommendedFor: ['table reservation', 'restaurant booking', 'dinner reservation'],
    properties: [
      { name: 'reservationFor', type: 'text', required: true, description: 'Restaurant' },
      { name: 'partySize', type: 'number', description: 'Number of guests' },
      { name: 'startTime', type: 'date', description: 'Reservation date/time' },
      { name: 'provider', type: 'text', description: 'Booking provider' },
    ]
  },

  Winery: {
    type: 'Winery',
    parent: 'FoodEstablishment',
    description: 'A winery',
    recommendedFor: ['winery', 'vineyard', 'wine tasting', 'wine', 'wine bar'],
    properties: FOOD_ESTABLISHMENT_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MEDICAL BUSINESS TYPES (24 types)
  // ─────────────────────────────────────────────────────────────────────────
  MedicalBusiness: {
    type: 'MedicalBusiness',
    parent: 'LocalBusiness',
    description: 'A medical or healthcare business',
    recommendedFor: ['medical', 'healthcare', 'health care', 'clinic'],
    properties: MEDICAL_PROPERTIES
  },

  CommunityHealth: {
    type: 'CommunityHealth',
    parent: 'MedicalBusiness',
    description: 'A community health center',
    recommendedFor: ['community health', 'public health center', 'community clinic'],
    properties: MEDICAL_PROPERTIES
  },

  Dentist: {
    type: 'Dentist',
    parent: 'MedicalBusiness',
    description: 'A dental practice',
    recommendedFor: ['dentist', 'dental', 'dental clinic', 'dental office', 'teeth', 'orthodontist'],
    properties: MEDICAL_PROPERTIES
  },

  Dermatology: {
    type: 'Dermatology',
    parent: 'MedicalBusiness',
    description: 'A dermatology practice',
    recommendedFor: ['dermatology', 'dermatologist', 'skin doctor', 'skin care clinic'],
    properties: MEDICAL_PROPERTIES
  },

  DietNutrition: {
    type: 'DietNutrition',
    parent: 'MedicalBusiness',
    description: 'A diet and nutrition practice',
    recommendedFor: ['nutritionist', 'dietitian', 'nutrition', 'diet clinic', 'weight loss clinic'],
    properties: MEDICAL_PROPERTIES
  },

  Emergency: {
    type: 'Emergency',
    parent: 'MedicalBusiness',
    description: 'An emergency medical facility',
    recommendedFor: ['emergency room', 'urgent care', 'er', 'emergency clinic'],
    properties: MEDICAL_PROPERTIES
  },

  Geriatric: {
    type: 'Geriatric',
    parent: 'MedicalBusiness',
    description: 'A geriatric medicine practice',
    recommendedFor: ['geriatric', 'senior care', 'elderly care', 'geriatrician'],
    properties: MEDICAL_PROPERTIES
  },

  Gynecologic: {
    type: 'Gynecologic',
    parent: 'MedicalBusiness',
    description: 'A gynecology practice',
    recommendedFor: ['gynecologist', 'gynecology', 'obgyn', 'women health'],
    properties: MEDICAL_PROPERTIES
  },

  MedicalClinic: {
    type: 'MedicalClinic',
    parent: 'MedicalBusiness',
    description: 'A medical clinic',
    recommendedFor: ['medical clinic', 'clinic', 'health clinic', 'walk in clinic'],
    properties: MEDICAL_PROPERTIES
  },

  Midwifery: {
    type: 'Midwifery',
    parent: 'MedicalBusiness',
    description: 'A midwifery practice',
    recommendedFor: ['midwife', 'midwifery', 'birth center', 'birthing center'],
    properties: MEDICAL_PROPERTIES
  },

  Nursing: {
    type: 'Nursing',
    parent: 'MedicalBusiness',
    description: 'A nursing facility',
    recommendedFor: ['nursing home', 'nursing facility', 'skilled nursing'],
    properties: MEDICAL_PROPERTIES
  },

  Obstetric: {
    type: 'Obstetric',
    parent: 'MedicalBusiness',
    description: 'An obstetric practice',
    recommendedFor: ['obstetrician', 'obstetrics', 'prenatal care', 'maternity'],
    properties: MEDICAL_PROPERTIES
  },

  Oncologic: {
    type: 'Oncologic',
    parent: 'MedicalBusiness',
    description: 'An oncology practice',
    recommendedFor: ['oncologist', 'oncology', 'cancer center', 'cancer treatment'],
    properties: MEDICAL_PROPERTIES
  },

  Optician: {
    type: 'Optician',
    parent: 'MedicalBusiness',
    description: 'An optician shop',
    recommendedFor: ['optician', 'eyeglasses', 'glasses shop', 'optical'],
    properties: MEDICAL_PROPERTIES
  },

  Optometric: {
    type: 'Optometric',
    parent: 'MedicalBusiness',
    description: 'An optometry practice',
    recommendedFor: ['optometrist', 'eye doctor', 'vision care', 'eye exam'],
    properties: MEDICAL_PROPERTIES
  },

  Otolaryngologic: {
    type: 'Otolaryngologic',
    parent: 'MedicalBusiness',
    description: 'An ENT practice',
    recommendedFor: ['ent', 'ear nose throat', 'otolaryngologist', 'ent doctor'],
    properties: MEDICAL_PROPERTIES
  },

  Pediatric: {
    type: 'Pediatric',
    parent: 'MedicalBusiness',
    description: 'A pediatric practice',
    recommendedFor: ['pediatrician', 'pediatrics', 'children doctor', 'kids doctor'],
    properties: MEDICAL_PROPERTIES
  },

  Pharmacy: {
    type: 'Pharmacy',
    parent: 'MedicalBusiness',
    description: 'A pharmacy',
    recommendedFor: ['pharmacy', 'drugstore', 'chemist', 'apothecary', 'prescription'],
    properties: MEDICAL_PROPERTIES
  },

  Physician: {
    type: 'Physician',
    parent: 'MedicalBusiness',
    description: 'A physician practice',
    recommendedFor: ['doctor', 'physician', 'md', 'doctor office', 'family doctor'],
    properties: MEDICAL_PROPERTIES
  },

  Physiotherapy: {
    type: 'Physiotherapy',
    parent: 'MedicalBusiness',
    description: 'A physiotherapy practice',
    recommendedFor: ['physical therapy', 'physiotherapy', 'pt', 'rehab', 'rehabilitation'],
    properties: MEDICAL_PROPERTIES
  },

  PlasticSurgery: {
    type: 'PlasticSurgery',
    parent: 'MedicalBusiness',
    description: 'A plastic surgery practice',
    recommendedFor: ['plastic surgery', 'cosmetic surgery', 'plastic surgeon'],
    properties: MEDICAL_PROPERTIES
  },

  Podiatric: {
    type: 'Podiatric',
    parent: 'MedicalBusiness',
    description: 'A podiatry practice',
    recommendedFor: ['podiatrist', 'podiatry', 'foot doctor', 'foot care'],
    properties: MEDICAL_PROPERTIES
  },

  PrimaryCare: {
    type: 'PrimaryCare',
    parent: 'MedicalBusiness',
    description: 'A primary care practice',
    recommendedFor: ['primary care', 'family medicine', 'general practitioner', 'gp'],
    properties: MEDICAL_PROPERTIES
  },

  Psychiatric: {
    type: 'Psychiatric',
    parent: 'MedicalBusiness',
    description: 'A psychiatric practice',
    recommendedFor: ['psychiatrist', 'psychiatry', 'mental health', 'psychiatric clinic'],
    properties: MEDICAL_PROPERTIES
  },

  PublicHealth: {
    type: 'PublicHealth',
    parent: 'MedicalBusiness',
    description: 'A public health facility',
    recommendedFor: ['public health', 'health department', 'public clinic'],
    properties: MEDICAL_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AUTOMOTIVE BUSINESS TYPES (9 types)
  // ─────────────────────────────────────────────────────────────────────────
  AutomotiveBusiness: {
    type: 'AutomotiveBusiness',
    parent: 'LocalBusiness',
    description: 'An automotive business',
    recommendedFor: ['automotive', 'car business', 'vehicle'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  AutoBodyShop: {
    type: 'AutoBodyShop',
    parent: 'AutomotiveBusiness',
    description: 'An auto body shop',
    recommendedFor: ['auto body', 'body shop', 'collision repair', 'auto paint'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  AutoDealer: {
    type: 'AutoDealer',
    parent: 'AutomotiveBusiness',
    description: 'An auto dealer',
    recommendedFor: ['car dealer', 'auto dealer', 'car dealership', 'used cars', 'new cars'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  AutoRental: {
    type: 'AutoRental',
    parent: 'AutomotiveBusiness',
    description: 'A car rental business',
    recommendedFor: ['car rental', 'auto rental', 'rent a car', 'vehicle rental'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  AutoRepair: {
    type: 'AutoRepair',
    parent: 'AutomotiveBusiness',
    description: 'An auto repair shop',
    recommendedFor: ['auto repair', 'car repair', 'mechanic', 'auto shop', 'garage', 'car mechanic'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  AutoWash: {
    type: 'AutoWash',
    parent: 'AutomotiveBusiness',
    description: 'A car wash',
    recommendedFor: ['car wash', 'auto wash', 'auto detailing', 'car detailing'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  GasStation: {
    type: 'GasStation',
    parent: 'AutomotiveBusiness',
    description: 'A gas station',
    recommendedFor: ['gas station', 'petrol station', 'fuel station', 'service station'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  MotorcycleDealer: {
    type: 'MotorcycleDealer',
    parent: 'AutomotiveBusiness',
    description: 'A motorcycle dealer',
    recommendedFor: ['motorcycle dealer', 'motorcycle shop', 'bike dealer', 'harley'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  MotorcycleRepair: {
    type: 'MotorcycleRepair',
    parent: 'AutomotiveBusiness',
    description: 'A motorcycle repair shop',
    recommendedFor: ['motorcycle repair', 'bike repair', 'motorcycle mechanic'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HOME AND CONSTRUCTION BUSINESS TYPES (8 types)
  // ─────────────────────────────────────────────────────────────────────────
  HomeAndConstructionBusiness: {
    type: 'HomeAndConstructionBusiness',
    parent: 'LocalBusiness',
    description: 'A home and construction business',
    recommendedFor: ['construction', 'home services', 'contractor'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  Electrician: {
    type: 'Electrician',
    parent: 'HomeAndConstructionBusiness',
    description: 'An electrician service',
    recommendedFor: ['electrician', 'electrical contractor', 'electrical services', 'wiring'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  GeneralContractor: {
    type: 'GeneralContractor',
    parent: 'HomeAndConstructionBusiness',
    description: 'A general contractor',
    recommendedFor: ['general contractor', 'contractor', 'builder', 'construction company', 'remodeling'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  HVACBusiness: {
    type: 'HVACBusiness',
    parent: 'HomeAndConstructionBusiness',
    description: 'An HVAC business',
    recommendedFor: ['hvac', 'heating', 'air conditioning', 'ac repair', 'furnace'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  HousePainter: {
    type: 'HousePainter',
    parent: 'HomeAndConstructionBusiness',
    description: 'A house painting service',
    recommendedFor: ['painter', 'house painter', 'painting contractor', 'interior painting'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  Locksmith: {
    type: 'Locksmith',
    parent: 'HomeAndConstructionBusiness',
    description: 'A locksmith service',
    recommendedFor: ['locksmith', 'lock service', 'key service', 'locks'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  MovingCompany: {
    type: 'MovingCompany',
    parent: 'HomeAndConstructionBusiness',
    description: 'A moving company',
    recommendedFor: ['moving company', 'movers', 'relocation', 'moving service'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  Plumber: {
    type: 'Plumber',
    parent: 'HomeAndConstructionBusiness',
    description: 'A plumbing service',
    recommendedFor: ['plumber', 'plumbing', 'plumbing service', 'drain cleaning'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  RoofingContractor: {
    type: 'RoofingContractor',
    parent: 'HomeAndConstructionBusiness',
    description: 'A roofing contractor',
    recommendedFor: ['roofer', 'roofing', 'roofing contractor', 'roof repair'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENTERTAINMENT BUSINESS TYPES (7 types)
  // ─────────────────────────────────────────────────────────────────────────
  EntertainmentBusiness: {
    type: 'EntertainmentBusiness',
    parent: 'LocalBusiness',
    description: 'An entertainment business',
    recommendedFor: ['entertainment', 'venue', 'amusement'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  AdultEntertainment: {
    type: 'AdultEntertainment',
    parent: 'EntertainmentBusiness',
    description: 'An adult entertainment venue',
    recommendedFor: ['adult entertainment', 'nightlife'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  AmusementPark: {
    type: 'AmusementPark',
    parent: 'EntertainmentBusiness',
    description: 'An amusement park',
    recommendedFor: ['amusement park', 'theme park', 'water park', 'fun park'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  ArtGallery: {
    type: 'ArtGallery',
    parent: 'EntertainmentBusiness',
    description: 'An art gallery',
    recommendedFor: ['art gallery', 'gallery', 'art studio', 'art exhibition'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  Casino: {
    type: 'Casino',
    parent: 'EntertainmentBusiness',
    description: 'A casino',
    recommendedFor: ['casino', 'gambling', 'gaming', 'slots'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  ComedyClub: {
    type: 'ComedyClub',
    parent: 'EntertainmentBusiness',
    description: 'A comedy club',
    recommendedFor: ['comedy club', 'comedy', 'stand up', 'improv'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  MovieTheater: {
    type: 'MovieTheater',
    parent: 'EntertainmentBusiness',
    description: 'A movie theater',
    recommendedFor: ['movie theater', 'cinema', 'movies', 'film theater'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  NightClub: {
    type: 'NightClub',
    parent: 'EntertainmentBusiness',
    description: 'A night club',
    recommendedFor: ['nightclub', 'club', 'dance club', 'disco'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LODGING BUSINESS TYPES (7 types)
  // ─────────────────────────────────────────────────────────────────────────
  LodgingBusiness: {
    type: 'LodgingBusiness',
    parent: 'LocalBusiness',
    description: 'A lodging business',
    recommendedFor: ['lodging', 'accommodation', 'stay'],
    properties: LODGING_PROPERTIES
  },

  BedAndBreakfast: {
    type: 'BedAndBreakfast',
    parent: 'LodgingBusiness',
    description: 'A bed and breakfast',
    recommendedFor: ['bed and breakfast', 'b&b', 'bnb', 'inn'],
    properties: LODGING_PROPERTIES
  },

  Campground: {
    type: 'Campground',
    parent: 'LodgingBusiness',
    description: 'A campground',
    recommendedFor: ['campground', 'camping', 'rv park', 'campsite'],
    properties: LODGING_PROPERTIES
  },

  Hostel: {
    type: 'Hostel',
    parent: 'LodgingBusiness',
    description: 'A hostel',
    recommendedFor: ['hostel', 'backpacker', 'budget accommodation'],
    properties: LODGING_PROPERTIES
  },

  Hotel: {
    type: 'Hotel',
    parent: 'LodgingBusiness',
    description: 'A hotel',
    recommendedFor: ['hotel', 'hotels', 'lodging', 'accommodation'],
    properties: LODGING_PROPERTIES
  },

  Motel: {
    type: 'Motel',
    parent: 'LodgingBusiness',
    description: 'A motel',
    recommendedFor: ['motel', 'motor hotel', 'motor lodge'],
    properties: LODGING_PROPERTIES
  },

  Resort: {
    type: 'Resort',
    parent: 'LodgingBusiness',
    description: 'A resort',
    recommendedFor: ['resort', 'vacation resort', 'beach resort', 'spa resort'],
    properties: LODGING_PROPERTIES
  },

  VacationRental: {
    type: 'VacationRental',
    parent: 'LodgingBusiness',
    description: 'A vacation rental',
    recommendedFor: ['vacation rental', 'airbnb', 'vrbo', 'short term rental', 'holiday rental'],
    properties: LODGING_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH AND BEAUTY BUSINESS TYPES (6 types)
  // ─────────────────────────────────────────────────────────────────────────
  HealthAndBeautyBusiness: {
    type: 'HealthAndBeautyBusiness',
    parent: 'LocalBusiness',
    description: 'A health and beauty business',
    recommendedFor: ['beauty', 'wellness', 'spa'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  BeautySalon: {
    type: 'BeautySalon',
    parent: 'HealthAndBeautyBusiness',
    description: 'A beauty salon',
    recommendedFor: ['beauty salon', 'beauty parlor', 'beauty shop', 'makeup'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  DaySpa: {
    type: 'DaySpa',
    parent: 'HealthAndBeautyBusiness',
    description: 'A day spa',
    recommendedFor: ['day spa', 'spa', 'massage spa', 'wellness spa'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  HairSalon: {
    type: 'HairSalon',
    parent: 'HealthAndBeautyBusiness',
    description: 'A hair salon',
    recommendedFor: ['hair salon', 'hairdresser', 'barber', 'hair stylist', 'barbershop', 'barber shop'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  HealthClub: {
    type: 'HealthClub',
    parent: 'HealthAndBeautyBusiness',
    description: 'A health club',
    recommendedFor: ['health club', 'fitness club', 'athletic club'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  NailSalon: {
    type: 'NailSalon',
    parent: 'HealthAndBeautyBusiness',
    description: 'A nail salon',
    recommendedFor: ['nail salon', 'nails', 'manicure', 'pedicure', 'nail spa'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  TattooParlor: {
    type: 'TattooParlor',
    parent: 'HealthAndBeautyBusiness',
    description: 'A tattoo parlor',
    recommendedFor: ['tattoo', 'tattoo parlor', 'tattoo shop', 'tattoo studio', 'piercing'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FINANCIAL SERVICE TYPES (4 types)
  // ─────────────────────────────────────────────────────────────────────────
  FinancialService: {
    type: 'FinancialService',
    parent: 'LocalBusiness',
    description: 'A financial service',
    recommendedFor: ['financial', 'finance', 'banking'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  AccountingService: {
    type: 'AccountingService',
    parent: 'FinancialService',
    description: 'An accounting service',
    recommendedFor: ['accountant', 'accounting', 'cpa', 'bookkeeper', 'bookkeeping', 'tax preparation'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  AutomatedTeller: {
    type: 'AutomatedTeller',
    parent: 'FinancialService',
    description: 'An ATM location',
    recommendedFor: ['atm', 'automated teller', 'cash machine'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  BankOrCreditUnion: {
    type: 'BankOrCreditUnion',
    parent: 'FinancialService',
    description: 'A bank or credit union',
    recommendedFor: ['bank', 'credit union', 'banking', 'savings'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  InsuranceAgency: {
    type: 'InsuranceAgency',
    parent: 'FinancialService',
    description: 'An insurance agency',
    recommendedFor: ['insurance', 'insurance agency', 'insurance agent', 'insurance broker'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EMERGENCY SERVICE TYPES (3 types)
  // ─────────────────────────────────────────────────────────────────────────
  EmergencyService: {
    type: 'EmergencyService',
    parent: 'LocalBusiness',
    description: 'An emergency service',
    recommendedFor: ['emergency', 'emergency services'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  FireStation: {
    type: 'FireStation',
    parent: 'EmergencyService',
    description: 'A fire station',
    recommendedFor: ['fire station', 'fire department', 'firehouse'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  Hospital: {
    type: 'Hospital',
    parent: 'EmergencyService',
    description: 'A hospital',
    recommendedFor: ['hospital', 'medical center', 'health center'],
    properties: [
      ...LOCAL_BUSINESS_PROPERTIES,
      { name: 'medicalSpecialty', type: 'text', description: 'Medical specialties' },
      { name: 'availableService', type: 'text', description: 'Available services' },
    ]
  },

  PoliceStation: {
    type: 'PoliceStation',
    parent: 'EmergencyService',
    description: 'A police station',
    recommendedFor: ['police station', 'police department', 'law enforcement'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PROFESSIONAL SERVICES
  // ─────────────────────────────────────────────────────────────────────────
  ProfessionalService: {
    type: 'ProfessionalService',
    parent: 'LocalBusiness',
    description: 'A professional service provider',
    recommendedFor: ['professional', 'consulting', 'agency', 'consultant'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Business name' },
      { name: 'description', type: 'text', description: 'Services description' },
      { name: 'telephone', type: 'phone', description: 'Phone number' },
      { name: 'email', type: 'email', description: 'Email' },
      { name: 'address', type: 'address', description: 'Address' },
      { name: 'areaServed', type: 'text', description: 'Service area' },
    ]
  },

  LegalService: {
    type: 'LegalService',
    parent: 'LocalBusiness',
    description: 'Legal services provider',
    recommendedFor: ['law firm', 'attorney', 'lawyer', 'legal services', 'legal'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Firm name' },
      { name: 'description', type: 'text', description: 'Practice areas' },
      { name: 'telephone', type: 'phone', description: 'Phone number' },
      { name: 'email', type: 'email', description: 'Email' },
      { name: 'address', type: 'address', description: 'Office address' },
    ]
  },

  RealEstateAgent: {
    type: 'RealEstateAgent',
    parent: 'LocalBusiness',
    description: 'A real estate agent or agency',
    recommendedFor: ['real estate', 'realtor', 'real estate agent', 'property', 'realty'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  TravelAgency: {
    type: 'TravelAgency',
    parent: 'LocalBusiness',
    description: 'A travel agency',
    recommendedFor: ['travel agency', 'travel agent', 'tour operator', 'vacation planner'],
    properties: LOCAL_BUSINESS_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SPORTS & FITNESS
  // ─────────────────────────────────────────────────────────────────────────
  SportsActivityLocation: {
    type: 'SportsActivityLocation',
    parent: 'LocalBusiness',
    description: 'Sports or fitness location',
    recommendedFor: ['gym', 'yoga studio', 'fitness center', 'sports club', 'fitness', 'yoga', 'pilates', 'crossfit'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Business name' },
      { name: 'description', type: 'text', description: 'About the facility' },
      { name: 'telephone', type: 'phone', description: 'Phone number' },
      { name: 'address', type: 'address', description: 'Address' },
      { name: 'openingHours', type: 'text', description: 'Hours' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCTS & SERVICES
  // ─────────────────────────────────────────────────────────────────────────
  Product: {
    type: 'Product',
    parent: 'Thing',
    description: 'A product for sale',
    recommendedFor: ['ecommerce', 'retail', 'product', 'online store'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Product name' },
      { name: 'description', type: 'text', description: 'Product description' },
      { name: 'image', type: 'image', description: 'Product image' },
      { name: 'brand', type: 'text', description: 'Brand name' },
      { name: 'sku', type: 'text', description: 'SKU' },
      { name: 'price', type: 'currency', description: 'Price' },
      { name: 'priceCurrency', type: 'text', description: 'Currency (e.g., USD)' },
      { name: 'availability', type: 'text', description: 'Availability status' },
      { name: 'aggregateRating', type: 'rating', description: 'Average rating' },
    ]
  },

  Service: {
    type: 'Service',
    parent: 'Thing',
    description: 'A service offered by a business',
    recommendedFor: ['service business', 'service provider'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Service name' },
      { name: 'description', type: 'text', description: 'Service description' },
      { name: 'serviceType', type: 'text', description: 'Type of service' },
      { name: 'provider', type: 'text', description: 'Service provider' },
      { name: 'areaServed', type: 'text', description: 'Service area' },
      { name: 'price', type: 'currency', description: 'Starting price' },
    ]
  },

  Offer: {
    type: 'Offer',
    parent: 'Thing',
    description: 'An offer to sell a product or service',
    recommendedFor: ['offer', 'deal', 'sale'],
    properties: [
      { name: 'name', type: 'text', description: 'Offer name' },
      { name: 'description', type: 'text', description: 'Offer details' },
      { name: 'price', type: 'currency', required: true, description: 'Price' },
      { name: 'priceCurrency', type: 'text', required: true, description: 'Currency' },
      { name: 'availability', type: 'text', description: 'Availability' },
      { name: 'url', type: 'url', description: 'Offer URL' },
    ]
  },

  SoftwareApplication: {
    type: 'SoftwareApplication',
    parent: 'CreativeWork',
    description: 'A software application',
    recommendedFor: ['saas', 'app', 'software', 'tech startup', 'application', 'platform'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'App name' },
      { name: 'description', type: 'text', description: 'App description' },
      { name: 'applicationCategory', type: 'text', description: 'App category' },
      { name: 'operatingSystem', type: 'text', description: 'Supported OS' },
      { name: 'offers', type: 'text', description: 'Pricing (nested Offer)' },
      { name: 'aggregateRating', type: 'rating', description: 'App rating' },
      { name: 'downloadUrl', type: 'url', description: 'Download URL' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PEOPLE
  // ─────────────────────────────────────────────────────────────────────────
  Person: {
    type: 'Person',
    parent: 'Thing',
    description: 'A person',
    recommendedFor: ['personal', 'portfolio', 'individual'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Full name' },
      { name: 'jobTitle', type: 'text', description: 'Job title' },
      { name: 'description', type: 'text', description: 'Bio' },
      { name: 'image', type: 'image', description: 'Photo' },
      { name: 'email', type: 'email', description: 'Email' },
      { name: 'telephone', type: 'phone', description: 'Phone' },
      { name: 'worksFor', type: 'text', description: 'Employer' },
      { name: 'sameAs', type: 'url', description: 'Social profiles' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT TYPES (23 types)
  // ─────────────────────────────────────────────────────────────────────────
  Event: {
    type: 'Event',
    parent: 'Thing',
    description: 'An event',
    recommendedFor: ['event', 'events', 'happening'],
    properties: EVENT_PROPERTIES
  },

  BusinessEvent: {
    type: 'BusinessEvent',
    parent: 'Event',
    description: 'A business event',
    recommendedFor: ['business event', 'corporate event', 'networking', 'trade show'],
    properties: EVENT_PROPERTIES
  },

  ChildrensEvent: {
    type: 'ChildrensEvent',
    parent: 'Event',
    description: 'An event for children',
    recommendedFor: ['kids event', 'children event', 'family event'],
    properties: EVENT_PROPERTIES
  },

  ComedyEvent: {
    type: 'ComedyEvent',
    parent: 'Event',
    description: 'A comedy event',
    recommendedFor: ['comedy show', 'comedy event', 'stand up comedy'],
    properties: EVENT_PROPERTIES
  },

  CourseInstance: {
    type: 'CourseInstance',
    parent: 'Event',
    description: 'An instance of a course',
    recommendedFor: ['class', 'workshop', 'course session', 'training session'],
    properties: [
      ...EVENT_PROPERTIES,
      { name: 'courseMode', type: 'text', description: 'Online/OnSite/Blended' },
      { name: 'instructor', type: 'text', description: 'Instructor name' },
    ]
  },

  DanceEvent: {
    type: 'DanceEvent',
    parent: 'Event',
    description: 'A dance event',
    recommendedFor: ['dance event', 'dance party', 'ball', 'prom'],
    properties: EVENT_PROPERTIES
  },

  DeliveryEvent: {
    type: 'DeliveryEvent',
    parent: 'Event',
    description: 'A delivery event',
    recommendedFor: ['delivery', 'shipping event'],
    properties: EVENT_PROPERTIES
  },

  EducationEvent: {
    type: 'EducationEvent',
    parent: 'Event',
    description: 'An education event',
    recommendedFor: ['education event', 'school event', 'graduation', 'seminar'],
    properties: EVENT_PROPERTIES
  },

  EventSeries: {
    type: 'EventSeries',
    parent: 'Event',
    description: 'A series of events',
    recommendedFor: ['event series', 'recurring event', 'festival series'],
    properties: EVENT_PROPERTIES
  },

  ExhibitionEvent: {
    type: 'ExhibitionEvent',
    parent: 'Event',
    description: 'An exhibition',
    recommendedFor: ['exhibition', 'expo', 'fair', 'show'],
    properties: EVENT_PROPERTIES
  },

  Festival: {
    type: 'Festival',
    parent: 'Event',
    description: 'A festival',
    recommendedFor: ['festival', 'fest', 'celebration', 'carnival'],
    properties: EVENT_PROPERTIES
  },

  FoodEvent: {
    type: 'FoodEvent',
    parent: 'Event',
    description: 'A food event',
    recommendedFor: ['food event', 'food festival', 'tasting', 'culinary event'],
    properties: EVENT_PROPERTIES
  },

  Hackathon: {
    type: 'Hackathon',
    parent: 'Event',
    description: 'A hackathon',
    recommendedFor: ['hackathon', 'hack day', 'coding event', 'code jam'],
    properties: EVENT_PROPERTIES
  },

  LiteraryEvent: {
    type: 'LiteraryEvent',
    parent: 'Event',
    description: 'A literary event',
    recommendedFor: ['book signing', 'author reading', 'literary event', 'book launch'],
    properties: EVENT_PROPERTIES
  },

  MusicEvent: {
    type: 'MusicEvent',
    parent: 'Event',
    description: 'A music event',
    recommendedFor: ['concert', 'music event', 'gig', 'recital', 'music festival'],
    properties: EVENT_PROPERTIES
  },

  PublicationEvent: {
    type: 'PublicationEvent',
    parent: 'Event',
    description: 'A publication event',
    recommendedFor: ['book release', 'publication', 'launch event'],
    properties: EVENT_PROPERTIES
  },

  SaleEvent: {
    type: 'SaleEvent',
    parent: 'Event',
    description: 'A sale event',
    recommendedFor: ['sale', 'clearance', 'black friday', 'discount event'],
    properties: EVENT_PROPERTIES
  },

  ScreeningEvent: {
    type: 'ScreeningEvent',
    parent: 'Event',
    description: 'A film screening',
    recommendedFor: ['screening', 'film screening', 'movie premiere', 'premiere'],
    properties: EVENT_PROPERTIES
  },

  SocialEvent: {
    type: 'SocialEvent',
    parent: 'Event',
    description: 'A social event',
    recommendedFor: ['party', 'gathering', 'social event', 'meetup'],
    properties: EVENT_PROPERTIES
  },

  SportsEvent: {
    type: 'SportsEvent',
    parent: 'Event',
    description: 'A sports event',
    recommendedFor: ['sports event', 'game', 'match', 'tournament', 'race'],
    properties: EVENT_PROPERTIES
  },

  TheaterEvent: {
    type: 'TheaterEvent',
    parent: 'Event',
    description: 'A theater event',
    recommendedFor: ['theater', 'theatre', 'play', 'musical', 'drama', 'performance'],
    properties: EVENT_PROPERTIES
  },

  VisualArtsEvent: {
    type: 'VisualArtsEvent',
    parent: 'Event',
    description: 'A visual arts event',
    recommendedFor: ['art show', 'gallery opening', 'art event', 'art exhibition'],
    properties: EVENT_PROPERTIES
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RATINGS & REVIEWS
  // ─────────────────────────────────────────────────────────────────────────
  Rating: {
    type: 'Rating',
    parent: 'Thing',
    description: 'A rating or review',
    properties: [
      { name: 'ratingValue', type: 'number', required: true, description: 'Rating value' },
      { name: 'bestRating', type: 'number', description: 'Best possible rating' },
      { name: 'worstRating', type: 'number', description: 'Worst possible rating' },
    ]
  },

  Review: {
    type: 'Review',
    parent: 'CreativeWork',
    description: 'A review',
    recommendedFor: ['review', 'reviews', 'testimonial'],
    properties: [
      { name: 'reviewBody', type: 'text', required: true, description: 'Review text' },
      { name: 'author', type: 'text', required: true, description: 'Reviewer name' },
      { name: 'datePublished', type: 'date', description: 'Review date' },
      { name: 'reviewRating', type: 'rating', description: 'Rating given' },
      { name: 'itemReviewed', type: 'text', description: 'Item being reviewed' },
    ]
  },

  AggregateRating: {
    type: 'AggregateRating',
    parent: 'Rating',
    description: 'Average rating based on multiple ratings',
    recommendedFor: ['rating', 'ratings'],
    properties: [
      { name: 'ratingValue', type: 'number', required: true, description: 'Average rating' },
      { name: 'bestRating', type: 'number', description: 'Highest possible (default 5)' },
      { name: 'worstRating', type: 'number', description: 'Lowest possible (default 1)' },
      { name: 'ratingCount', type: 'number', description: 'Number of ratings' },
      { name: 'reviewCount', type: 'number', description: 'Number of reviews' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LISTS
  // ─────────────────────────────────────────────────────────────────────────
  ItemList: {
    type: 'ItemList',
    parent: 'Thing',
    description: 'A list of items',
    recommendedFor: ['list', 'collection', 'catalog'],
    properties: [
      { name: 'name', type: 'text', description: 'List name' },
      { name: 'description', type: 'text', description: 'List description' },
      { name: 'numberOfItems', type: 'number', description: 'Item count' },
      { name: 'itemListElement', type: 'text', description: 'List items (nested)' },
    ]
  },

  BreadcrumbList: {
    type: 'BreadcrumbList',
    parent: 'ItemList',
    description: 'A breadcrumb trail for navigation',
    recommendedFor: ['breadcrumb', 'navigation'],
    properties: [
      { name: 'itemListElement', type: 'text', required: true, description: 'Breadcrumb items' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONTACT & LOCATION
  // ─────────────────────────────────────────────────────────────────────────
  ContactPoint: {
    type: 'ContactPoint',
    parent: 'Thing',
    description: 'A contact point for a person or organization',
    properties: [
      { name: 'telephone', type: 'phone', description: 'Phone number' },
      { name: 'email', type: 'email', description: 'Email address' },
      { name: 'contactType', type: 'text', description: 'Type of contact (sales, support, etc.)' },
      { name: 'areaServed', type: 'text', description: 'Geographic area served' },
      { name: 'availableLanguage', type: 'text', description: 'Languages available' },
    ]
  },

  AboutPage: {
    type: 'AboutPage',
    parent: 'WebPage',
    description: 'An about page describing a person or organization',
    recommendedFor: ['about', 'about us', 'about me', 'our story', 'who we are', 'our team', 'our mission'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Page title' },
      { name: 'description', type: 'text', description: 'Page description' },
      { name: 'url', type: 'url', description: 'Canonical URL' },
    ]
  },

  ContactPage: {
    type: 'ContactPage',
    parent: 'WebPage',
    description: 'A contact page',
    recommendedFor: ['contact'],
    properties: [
      { name: 'name', type: 'text', required: true, description: 'Page title' },
      { name: 'description', type: 'text', description: 'Page description' },
      { name: 'telephone', type: 'phone', description: 'Phone number' },
      { name: 'email', type: 'email', description: 'Email address' },
      { name: 'address', type: 'address', description: 'Physical address' },
    ]
  },

  PostalAddress: {
    type: 'PostalAddress',
    parent: 'ContactPoint',
    description: 'A mailing address',
    recommendedFor: ['address'],
    properties: [
      { name: 'streetAddress', type: 'text', description: 'Street address' },
      { name: 'addressLocality', type: 'text', description: 'City' },
      { name: 'addressRegion', type: 'text', description: 'State/Province' },
      { name: 'postalCode', type: 'text', description: 'ZIP/Postal code' },
      { name: 'addressCountry', type: 'text', description: 'Country' },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get schema definition with inherited properties from parent
 */
export function getSchemaWithInheritance(schemaType: string): SchemaTypeDefinition | null {
  const schema = SCHEMA_REGISTRY[schemaType];
  if (!schema) return null;

  const allProperties: SchemaProperty[] = [...schema.properties];

  // Walk up the inheritance chain
  let parent = schema.parent;
  while (parent && SCHEMA_REGISTRY[parent]) {
    const parentSchema = SCHEMA_REGISTRY[parent];
    // Add parent properties that aren't already defined
    for (const prop of parentSchema.properties) {
      if (!allProperties.find(p => p.name === prop.name)) {
        allProperties.push(prop);
      }
    }
    parent = parentSchema.parent;
  }

  return {
    ...schema,
    properties: allProperties
  };
}

/**
 * Calculate match score between a query and schema keywords
 * Scoring:
 * - Exact match: 100 points
 * - Contains match: 50 points
 * - Word-level match: 20 points per word
 */
function calculateMatchScore(query: string, keywords: string[]): number {
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/);
  let maxScore = 0;

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    let score = 0;

    // Exact match
    if (queryLower === keywordLower) {
      score = 100;
    }
    // Query contains keyword exactly
    else if (queryLower.includes(keywordLower)) {
      score = 50;
    }
    // Keyword contains query exactly
    else if (keywordLower.includes(queryLower)) {
      score = 40;
    }
    // Word-level matching
    else {
      const keywordWords = keywordLower.split(/\s+/);
      let wordMatches = 0;
      for (const qWord of queryWords) {
        if (qWord.length > 2) { // Skip very short words
          for (const kWord of keywordWords) {
            if (kWord.includes(qWord) || qWord.includes(kWord)) {
              wordMatches++;
              break;
            }
          }
        }
      }
      score = wordMatches * 20;
    }

    maxScore = Math.max(maxScore, score);
  }

  return maxScore;
}

/**
 * Get the depth of a schema type in the inheritance hierarchy
 * More specific types (deeper) are preferred
 */
function getSchemaDepth(schemaType: string): number {
  let depth = 0;
  let current = SCHEMA_REGISTRY[schemaType];
  while (current?.parent && SCHEMA_REGISTRY[current.parent]) {
    depth++;
    current = SCHEMA_REGISTRY[current.parent];
  }
  return depth;
}

/**
 * Get recommended schema type for a business type
 * Uses scoring algorithm to find best match with preference for specific types
 */
export function getRecommendedSchema(businessType: string): string {
  const businessLower = businessType.toLowerCase().trim();

  // Collect all matches with scores
  const matches: { type: string; score: number; depth: number }[] = [];

  for (const [schemaType, definition] of Object.entries(SCHEMA_REGISTRY)) {
    if (!definition.recommendedFor || definition.recommendedFor.includes('any')) {
      continue;
    }

    const score = calculateMatchScore(businessLower, definition.recommendedFor);
    if (score > 0) {
      matches.push({
        type: schemaType,
        score,
        depth: getSchemaDepth(schemaType)
      });
    }
  }

  // Sort by score (descending), then by depth (descending - more specific wins)
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.depth - a.depth;
  });

  // Return best match or default
  if (matches.length > 0 && matches[0].score >= 20) {
    return matches[0].type;
  }

  // Default to LocalBusiness for physical businesses, Organization for others
  return 'LocalBusiness';
}

/**
 * Get all schema types as a list
 */
export function getAllSchemaTypes(): string[] {
  return Object.keys(SCHEMA_REGISTRY);
}

/**
 * Get schema types by category
 */
export function getSchemaTypesByCategory(): Record<string, string[]> {
  return {
    'Business & Organization': [
      'Organization', 'LocalBusiness', 'ProfessionalService', 'LegalService',
      'RealEstateAgent', 'TravelAgency'
    ],
    'Store Types': [
      'Store', 'AutoPartsStore', 'BikeStore', 'BookStore', 'ClothingStore',
      'ComputerStore', 'ConvenienceStore', 'DepartmentStore', 'ElectronicsStore',
      'Florist', 'FurnitureStore', 'GardenStore', 'GroceryStore', 'HardwareStore',
      'HobbyShop', 'HomeGoodsStore', 'JewelryStore', 'LiquorStore', 'MensClothingStore',
      'MobilePhoneStore', 'MovieRentalStore', 'MusicStore', 'OfficeEquipmentStore',
      'OutletStore', 'PawnShop', 'PetStore', 'ShoeStore', 'SportingGoodsStore',
      'TireShop', 'ToyStore', 'WholesaleStore'
    ],
    'Food & Dining': [
      'FoodEstablishment', 'Bakery', 'BarOrPub', 'Brewery', 'CafeOrCoffeeShop',
      'Distillery', 'FastFoodRestaurant', 'IceCreamShop', 'Restaurant', 'Winery'
    ],
    'Medical & Health': [
      'MedicalBusiness', 'CommunityHealth', 'Dentist', 'Dermatology', 'DietNutrition',
      'Emergency', 'Geriatric', 'Gynecologic', 'MedicalClinic', 'Midwifery',
      'Nursing', 'Obstetric', 'Oncologic', 'Optician', 'Optometric',
      'Otolaryngologic', 'Pediatric', 'Pharmacy', 'Physician', 'Physiotherapy',
      'PlasticSurgery', 'Podiatric', 'PrimaryCare', 'Psychiatric', 'PublicHealth'
    ],
    'Automotive': [
      'AutomotiveBusiness', 'AutoBodyShop', 'AutoDealer', 'AutoRental',
      'AutoRepair', 'AutoWash', 'GasStation', 'MotorcycleDealer', 'MotorcycleRepair'
    ],
    'Home & Construction': [
      'HomeAndConstructionBusiness', 'Electrician', 'GeneralContractor',
      'HVACBusiness', 'HousePainter', 'Locksmith', 'MovingCompany', 'Plumber',
      'RoofingContractor'
    ],
    'Entertainment': [
      'EntertainmentBusiness', 'AdultEntertainment', 'AmusementPark', 'ArtGallery',
      'Casino', 'ComedyClub', 'MovieTheater', 'NightClub'
    ],
    'Lodging': [
      'LodgingBusiness', 'BedAndBreakfast', 'Campground', 'Hostel',
      'Hotel', 'Motel', 'Resort', 'VacationRental'
    ],
    'Health & Beauty': [
      'HealthAndBeautyBusiness', 'BeautySalon', 'DaySpa', 'HairSalon',
      'HealthClub', 'NailSalon', 'TattooParlor'
    ],
    'Financial Services': [
      'FinancialService', 'AccountingService', 'AutomatedTeller',
      'BankOrCreditUnion', 'InsuranceAgency'
    ],
    'Emergency Services': [
      'EmergencyService', 'FireStation', 'Hospital', 'PoliceStation'
    ],
    'Sports & Fitness': ['SportsActivityLocation'],
    'Products & Services': ['Product', 'Service', 'Offer', 'SoftwareApplication'],
    'Creative Works': [
      'CreativeWork', 'WebPage', 'Article', 'BlogPosting', 'NewsArticle',
      'FAQPage', 'HowTo', 'Recipe', 'Course', 'Book', 'Movie',
      'MusicRecording', 'SoftwareSourceCode'
    ],
    'People': ['Person'],
    'Events': [
      'Event', 'BusinessEvent', 'ChildrensEvent', 'ComedyEvent', 'CourseInstance',
      'DanceEvent', 'DeliveryEvent', 'EducationEvent', 'EventSeries',
      'ExhibitionEvent', 'Festival', 'FoodEvent', 'Hackathon', 'LiteraryEvent',
      'MusicEvent', 'PublicationEvent', 'SaleEvent', 'ScreeningEvent',
      'SocialEvent', 'SportsEvent', 'TheaterEvent', 'VisualArtsEvent'
    ],
    'Ratings & Reviews': ['Review', 'AggregateRating'],
    'Lists & Collections': ['ItemList'],
    'Contact & Location': ['AboutPage', 'ContactPage', 'PostalAddress'],
  };
}

/**
 * Build JSON-LD from content values
 */
export function buildJsonLd(
  schemaType: string,
  content: Record<string, any>,
  baseUrl?: string
): object {
  const schema = getSchemaWithInheritance(schemaType);
  if (!schema) {
    return {
      '@context': 'https://schema.org',
      '@type': schemaType,
      ...content
    };
  }

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': schemaType
  };

  // Add URL if provided
  if (baseUrl) {
    jsonLd.url = baseUrl;
  }

  // Map content to schema properties
  for (const prop of schema.properties) {
    if (content[prop.name] !== undefined && content[prop.name] !== '') {
      jsonLd[prop.name] = content[prop.name];
    }
  }

  return jsonLd;
}

/**
 * Validate content against schema
 */
export function validateContent(
  schemaType: string,
  content: Record<string, any>
): { valid: boolean; errors: string[] } {
  const schema = getSchemaWithInheritance(schemaType);
  const errors: string[] = [];

  if (!schema) {
    return { valid: true, errors: [] }; // Unknown schema, allow anything
  }

  // Check required properties
  for (const prop of schema.properties) {
    if (prop.required && (!content[prop.name] || content[prop.name] === '')) {
      errors.push(`Missing required property: ${prop.name}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED SCHEMA BUILDER — single source of truth for all JSON-LD generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Business context interface for schema generation.
 * Matches the BusinessContext used by the build pipeline.
 */
export interface SchemaBusinessContext {
  businessName: string;
  businessType: string;
  description: string;
  email?: string;
  phone?: string;
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  geo?: { latitude: number; longitude: number };
  hours?: string;
  priceRange?: string;
  rating?: { value: number; count: number };
  testimonials?: { quote: string; author: string; role?: string }[];
  services?: string[];
  pricing?: { name: string; price: string; description: string }[];
  menuItems?: { name: string; description: string; price?: string }[];
  siteUrl?: string;
  socialImage?: string;
}

/**
 * Result of building all schemas for a page.
 */
export interface PageSchemaResult {
  primary: object;           // Main business/page schema
  breadcrumb: object;        // BreadcrumbList
  reviews: object[];         // Individual Review schemas
  additional: object[];      // Menu, Reservation, Product, etc.
  all: object[];             // Flattened array of everything above
}

// ── Food establishment types recognized by the registry ──
const FOOD_ESTABLISHMENT_TYPES = [
  'Restaurant', 'FoodEstablishment', 'Bakery', 'CafeOrCoffeeShop',
  'Brewery', 'Winery', 'BarOrPub', 'FastFoodRestaurant', 'IceCreamShop'
];

// ── Store / ecommerce types ──
const STORE_TYPES = [
  'Store', 'AutoPartsStore', 'BikeStore', 'BookStore', 'ClothingStore',
  'ComputerStore', 'ConvenienceStore', 'DepartmentStore', 'ElectronicsStore',
  'Florist', 'FurnitureStore', 'GardenStore', 'GroceryStore', 'HardwareStore',
  'HobbyShop', 'HomeGoodsStore', 'JewelryStore', 'LiquorStore', 'MensClothingStore',
  'MobilePhoneStore', 'MovieRentalStore', 'MusicStore', 'OfficeEquipmentStore',
  'OutletStore', 'PawnShop', 'PetStore', 'ShoeStore', 'SportingGoodsStore',
  'TireShop', 'ToyStore', 'WholesaleStore'
];

// ── Professional service types ──
const PROFESSIONAL_SERVICE_TYPES = [
  'LegalService', 'AccountingService', 'FinancialService', 'InsuranceAgency',
  'RealEstateAgent', 'TravelAgency', 'EmploymentAgency'
];

// ── Medical types ──
const MEDICAL_TYPES = [
  'MedicalBusiness', 'Dentist', 'Physician', 'Pharmacy', 'Optician',
  'MedicalClinic', 'VeterinaryCare', 'DiagnosticLab'
];

// ── Software / SaaS types ──
const SOFTWARE_TYPES = [
  'SoftwareApplication', 'WebApplication', 'MobileApplication'
];

/**
 * Build the primary JSON-LD schema for a business, using the registry for
 * type awareness and property validation, with full nested object support.
 *
 * This replaces the old buildFullSchema() in build-website.ts.
 * It uses buildJsonLd() for registry-aware property mapping, then layers
 * on the nested structures (address, rating, reviews, hours) that the
 * flat buildJsonLd() can't handle alone.
 */
export function buildSchemaFromContext(
  schemaType: string,
  context: SchemaBusinessContext,
  pageUrl: string
): object {
  // Start with registry-aware flat mapping
  const flatContent: Record<string, any> = {
    name: context.businessName,
    description: context.description,
    image: context.socialImage || '',
  };

  // Contact info — map to registry property names
  if (context.email) flatContent.email = context.email;
  if (context.phone) flatContent.telephone = context.phone;
  if (context.priceRange) flatContent.priceRange = context.priceRange;

  // Build base schema using the registry (validates against known properties)
  const schema = buildJsonLd(schemaType, flatContent, pageUrl) as Record<string, any>;

  // ── Nested structures (registry can't handle these as flat props) ──

  // PostalAddress
  if (context.address || context.streetAddress) {
    schema.address = {
      '@type': 'PostalAddress',
      'streetAddress': context.streetAddress || context.address?.split(',')[0]?.trim(),
      'addressLocality': context.city || context.address?.split(',')[1]?.trim(),
      'addressRegion': context.state || context.address?.split(',')[2]?.trim()?.split(' ')[0],
      'postalCode': context.postalCode || context.address?.match(/\d{5}/)?.[0],
      'addressCountry': context.country || 'US'
    };
  }

  // GeoCoordinates
  if (context.geo) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      'latitude': context.geo.latitude,
      'longitude': context.geo.longitude
    };
  }

  // OpeningHoursSpecification
  if (context.hours) {
    schema.openingHoursSpecification = parseOpeningHours(context.hours);
  }

  // AggregateRating
  if (context.rating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      'ratingValue': context.rating.value,
      'bestRating': 5,
      'worstRating': 1,
      'reviewCount': context.rating.count
    };
  }

  // Area served
  if (context.city || context.state) {
    schema.areaServed = {
      '@type': 'City',
      'name': context.city || context.address?.split(',')[1]?.trim()
    };
  }

  // AboutPage — add Organization as mainEntity
  if (schemaType === 'AboutPage') {
    schema.mainEntity = {
      '@type': 'Organization',
      'name': context.businessName,
      'description': context.description,
    };
    if (context.siteUrl) schema.mainEntity.url = context.siteUrl;
    if (context.phone) schema.mainEntity.telephone = context.phone;
    if (context.email) schema.mainEntity.email = context.email;
  }

  // Inline reviews (for primary schema; standalone Reviews are built separately)
  if (context.testimonials && context.testimonials.length > 0) {
    schema.review = context.testimonials.map((t, i) => ({
      '@type': 'Review',
      'author': { '@type': 'Person', 'name': t.author || `Customer ${i + 1}` },
      'reviewBody': t.quote,
      'reviewRating': { '@type': 'Rating', 'ratingValue': 5, 'bestRating': 5, 'worstRating': 1 }
    }));
  }

  return schema;
}

/**
 * Build BreadcrumbList schema
 */
export function buildBreadcrumbSchemaFromContext(
  pageName: string,
  pageUrl: string,
  siteUrl: string
): object {
  const items: object[] = [
    { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': siteUrl || '/' }
  ];

  if (pageName.toLowerCase() !== 'homepage') {
    items.push({ '@type': 'ListItem', 'position': 2, 'name': pageName, 'item': pageUrl });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items
  };
}

/**
 * Build standalone Review schemas (separate JSON-LD blocks for rich results)
 */
export function buildReviewSchemas(context: SchemaBusinessContext): object[] {
  if (!context.testimonials || context.testimonials.length === 0) return [];

  const schemaType = getRecommendedSchema(context.businessType);

  return context.testimonials.map((t, i) => ({
    '@context': 'https://schema.org',
    '@type': 'Review',
    'itemReviewed': { '@type': schemaType, 'name': context.businessName },
    'author': { '@type': 'Person', 'name': t.author || `Customer ${i + 1}` },
    'reviewBody': t.quote,
    'reviewRating': { '@type': 'Rating', 'ratingValue': 5, 'bestRating': 5, 'worstRating': 1 },
    'datePublished': new Date().toISOString().split('T')[0]
  }));
}

/**
 * Build Menu schema for food establishments
 */
export function buildMenuSchema(context: SchemaBusinessContext): object {
  const menuItems = context.menuItems || context.services?.map((s, i) => ({
    name: s,
    description: `Delicious ${s.toLowerCase()}`,
    price: context.pricing?.[i]?.price || '$12-$25'
  })) || [];

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    'name': `${context.businessName} Menu`,
    'description': `Full menu for ${context.businessName}`,
    'hasMenuSection': [{
      '@type': 'MenuSection',
      'name': 'Main Menu',
      'hasMenuItem': menuItems.map(item => ({
        '@type': 'MenuItem',
        'name': item.name,
        'description': item.description,
        'offers': {
          '@type': 'Offer',
          'price': (typeof item.price === 'string' ? item.price.replace(/[^0-9.]/g, '') : item.price) || '15',
          'priceCurrency': 'USD'
        }
      }))
    }]
  };
}

/**
 * Build FoodEstablishmentReservation schema
 */
export function buildReservationSchema(context: SchemaBusinessContext): object {
  const schemaType = getRecommendedSchema(context.businessType);

  return {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishmentReservation',
    'reservationFor': {
      '@type': schemaType,
      'name': context.businessName,
      'address': context.address,
      'telephone': context.phone
    },
    'provider': { '@type': 'Organization', 'name': context.businessName },
    'potentialAction': {
      '@type': 'ReserveAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${context.siteUrl || ''}/reservations`,
        'actionPlatform': [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform'
        ]
      },
      'result': { '@type': 'FoodEstablishmentReservation', 'name': 'Table Reservation' }
    }
  };
}

/**
 * Build Product schema for stores/ecommerce
 */
export function buildProductSchemas(context: SchemaBusinessContext): object[] {
  if (!context.pricing || context.pricing.length === 0) return [];

  return context.pricing.map(item => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': item.name,
    'description': item.description,
    'offers': {
      '@type': 'Offer',
      'price': item.price.replace(/[^0-9.]/g, '') || '0',
      'priceCurrency': 'USD',
      'availability': 'https://schema.org/InStock'
    }
  }));
}

/**
 * Build Service schema for professional services
 */
export function buildServiceSchemas(context: SchemaBusinessContext): object[] {
  if (!context.services || context.services.length === 0) return [];

  return context.services.map(service => ({
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': service,
    'provider': { '@type': 'Organization', 'name': context.businessName },
    'areaServed': context.city ? { '@type': 'City', 'name': context.city } : undefined
  }));
}

/**
 * Build SoftwareApplication schema for SaaS
 */
export function buildSoftwareSchema(context: SchemaBusinessContext): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': context.businessName,
    'description': context.description,
    'applicationCategory': 'BusinessApplication',
    'operatingSystem': 'Web',
    'offers': context.pricing && context.pricing.length > 0 ? {
      '@type': 'AggregateOffer',
      'lowPrice': context.pricing[0]?.price.replace(/[^0-9.]/g, '') || '0',
      'highPrice': context.pricing[context.pricing.length - 1]?.price.replace(/[^0-9.]/g, '') || '0',
      'priceCurrency': 'USD',
      'offerCount': context.pricing.length
    } : undefined,
    ...(context.rating ? {
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': context.rating.value,
        'bestRating': 5,
        'reviewCount': context.rating.count
      }
    } : {})
  };
}

/**
 * Master function: build ALL schemas for a given page.
 *
 * Uses the registry's getRecommendedSchema() to determine the business type,
 * then selects the right combination of schemas based on category.
 *
 * This is the single entry point the build pipeline should call.
 */
export function buildPageSchemas(
  context: SchemaBusinessContext,
  pageName: string,
  pageUrl: string,
  pageFilename: string
): PageSchemaResult {
  const schemaType = getRecommendedSchema(context.businessType);
  const siteUrl = context.siteUrl || '';

  // 1. Primary business schema (always)
  const primary = buildSchemaFromContext(schemaType, context, pageUrl);

  // 2. Breadcrumbs (always)
  const breadcrumb = buildBreadcrumbSchemaFromContext(pageName, pageUrl, siteUrl);

  // 3. Reviews (if testimonials exist)
  const reviews = buildReviewSchemas(context);

  // 4. Category-specific additional schemas
  const additional: object[] = [];

  const isFoodEstablishment = FOOD_ESTABLISHMENT_TYPES.includes(schemaType);
  const isStore = STORE_TYPES.includes(schemaType);
  const isProfessionalService = PROFESSIONAL_SERVICE_TYPES.includes(schemaType);
  const isSoftware = SOFTWARE_TYPES.includes(schemaType);

  // Food: Menu + Reservations
  if (isFoodEstablishment) {
    if (pageFilename === 'menu.html') {
      additional.push(buildMenuSchema(context));
    }
    if (pageFilename === 'reservations.html') {
      additional.push(buildReservationSchema(context));
    }
  }

  // Store: Product schemas on product pages
  if (isStore && (pageFilename === 'products.html' || pageFilename === 'index.html')) {
    additional.push(...buildProductSchemas(context));
  }

  // Professional services: Service schemas
  if (isProfessionalService && (pageFilename === 'services.html' || pageFilename === 'index.html')) {
    additional.push(...buildServiceSchemas(context));
  }

  // SaaS: SoftwareApplication schema
  if (isSoftware && (pageFilename === 'index.html' || pageFilename === 'pricing.html')) {
    additional.push(buildSoftwareSchema(context));
  }

  // All combined
  const all = [primary, breadcrumb, ...reviews, ...additional];

  return { primary, breadcrumb, reviews, additional, all };
}

// ── Hours parsing helpers (moved from build-website.ts) ──

function parseOpeningHours(hoursString: string): object[] {
  const specs: object[] = [];
  const dayMap: Record<string, string> = {
    'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday',
    'thu': 'Thursday', 'fri': 'Friday', 'sat': 'Saturday', 'sun': 'Sunday'
  };

  const parts = hoursString.split(',').map(s => s.trim());
  for (const part of parts) {
    const match = part.match(/(\w+)-(\w+)\s+(\d+(?::\d+)?(?:am|pm)?)-(\d+(?::\d+)?(?:am|pm)?)/i);
    if (match) {
      const startDay = dayMap[match[1].toLowerCase().substring(0, 3)];
      const endDay = dayMap[match[2].toLowerCase().substring(0, 3)];
      const opens = convertTo24Hour(match[3]);
      const closes = convertTo24Hour(match[4]);
      if (startDay && endDay) {
        specs.push({
          '@type': 'OpeningHoursSpecification',
          'dayOfWeek': getDayRange(startDay, endDay),
          'opens': opens,
          'closes': closes
        });
      }
    }
  }

  return specs.length > 0 ? specs : [{
    '@type': 'OpeningHoursSpecification',
    'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    'opens': '09:00',
    'closes': '17:00'
  }];
}

function convertTo24Hour(time: string): string {
  const match = time.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
  if (!match) return '09:00';
  let hours = parseInt(match[1]);
  const minutes = match[2] || '00';
  const period = match[3]?.toLowerCase();
  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

function getDayRange(start: string, end: string): string[] {
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const startIdx = allDays.indexOf(start);
  const endIdx = allDays.indexOf(end);
  if (startIdx === -1 || endIdx === -1) return allDays.slice(0, 5);
  if (startIdx <= endIdx) return allDays.slice(startIdx, endIdx + 1);
  return [...allDays.slice(startIdx), ...allDays.slice(0, endIdx + 1)];
}
