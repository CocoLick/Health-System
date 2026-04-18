package models

import (
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	UserID     string    `gorm:"column:user_id;primaryKey" json:"user_id"`
	Username   string    `gorm:"column:username;not null" json:"username"`
	Password   string    `gorm:"column:password;not null" json:"-"`
	Phone      string    `gorm:"column:phone;not null" json:"phone"`
	Gender     string    `gorm:"column:gender;not null" json:"gender"`
	Age        int       `gorm:"column:age;not null" json:"age"`
	Email      string    `gorm:"column:email;not null" json:"email"`
	RoleType   string    `gorm:"column:role_type;not null" json:"role_type"`
	CreatedAt  time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

// TableName 指定表名
func (User) TableName() string {
	return "user"
}

// BeforeSave 保存前加密密码
func (u *User) BeforeSave(tx *gorm.DB) error {
	if u.Password != "" {
		fmt.Printf("加密前密码: %s\n", u.Password)
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		u.Password = string(hashedPassword)
		fmt.Printf("加密后密码: %s\n", u.Password)
	}
	return nil
}

// CheckPassword 检查密码是否正确
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	fmt.Printf("密码验证结果: %v\n", err)
	return err == nil
}
