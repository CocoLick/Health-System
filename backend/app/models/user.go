package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	UserID   string `gorm:"column:user_id;primaryKey" json:"user_id"`
	Username string `gorm:"column:username;not null" json:"username"`
	Name     string `gorm:"column:name" json:"name"`
	Password string `gorm:"column:password;not null" json:"-"`
	Phone    string `gorm:"column:phone" json:"phone"`
	Gender   string `gorm:"column:gender" json:"gender"`
	Age      int    `gorm:"column:age" json:"age"`
	Email    string `gorm:"column:email" json:"email"`
	RoleType string `gorm:"column:role_type;not null" json:"role_type"`
	// 拆分角色后，规划师专属字段迁移至 dietitian 表。
	// 这里保留 JSON 字段以兼容既有前端结构，但不再映射到 user 表列。
	Title     string    `gorm:"-" json:"title,omitempty"`
	Specialty string    `gorm:"-" json:"specialty,omitempty"`
	Introduction string `gorm:"-" json:"introduction,omitempty"`
	Contact   string    `gorm:"-" json:"contact,omitempty"`
	CurrentServiceUserCount    int     `gorm:"-" json:"current_service_user_count,omitempty"`
	HistoricalServiceUserCount int     `gorm:"-" json:"historical_service_user_count,omitempty"`
	HistoricalAvgRating        float64 `gorm:"-" json:"historical_avg_rating,omitempty"`
	RatingCount                int     `gorm:"-" json:"rating_count,omitempty"`
	Status    string    `gorm:"column:status" json:"status"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

// TableName 指定表名
func (User) TableName() string {
	return "user"
}

// BeforeSave 保存前加密密码
func (u *User) BeforeSave(tx *gorm.DB) error {
	if u.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		u.Password = string(hashedPassword)
	}
	return nil
}

// CheckPassword 检查密码是否正确
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}
