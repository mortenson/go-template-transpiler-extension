package types

// User represents a user in the system.
type User struct {
	Name     string  // Full name of the user
	Email    string  // Email address of the user
	Age      int     // Age of the user
	IsActive bool    // Is the user active?
	Profile  Profile // Profile information of the user
	Posts    []Post  // List of posts made by the user
}

type Profile struct {
	Bio     string // Bio of the user
	Website string // Website of the user
	Avatar  string // Avatar image URL of the user
}

type Post struct {
	Title   string   // Title of the post
	Content string   // Content of the post
	Author  User     // Author of the post
	Tags    []string // Tags associated with the post
}
